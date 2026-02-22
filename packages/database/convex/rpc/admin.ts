import { createRpcFactory, makeRpcModule } from "@packages/confect/rpc";
import { Effect, Option, Schema } from "effect";
import { internal } from "../_generated/api";
import { ConfectMutationCtx, ConfectQueryCtx, confectSchema } from "../confect";
import {
	checkRunsByRepo,
	issuesByRepo,
	prsByRepo,
	webhooksByState,
} from "../shared/aggregates";
import { DatabaseRpcModuleMiddlewares } from "./moduleMiddlewares";
import { AdminTokenMiddleware } from "./security";

const factory = createRpcFactory({ schema: confectSchema });

// ---------------------------------------------------------------------------
// Endpoint definitions (schema only — no handler bodies)
// ---------------------------------------------------------------------------

const healthCheckDef = factory
	.query({
		payload: {
			adminToken: Schema.String,
		},
		success: Schema.Struct({
			ok: Schema.Boolean,
			tableCount: Schema.Number,
		}),
	})
	.middleware(AdminTokenMiddleware);

const tableCountsDef = factory
	.query({
		payload: {
			adminToken: Schema.String,
		},
		success: Schema.Struct({
			repositories: Schema.Number,
			branches: Schema.Number,
			commits: Schema.Number,
			pullRequests: Schema.Number,
			pullRequestReviews: Schema.Number,
			issues: Schema.Number,
			issueComments: Schema.Number,
			checkRuns: Schema.Number,
			users: Schema.Number,
			syncJobs: Schema.Number,
			installations: Schema.Number,
			webhookEvents: Schema.Number,
		}),
	})
	.middleware(AdminTokenMiddleware);

const syncJobStatusDef = factory
	.query({
		payload: {
			adminToken: Schema.String,
		},
		success: Schema.Array(
			Schema.Struct({
				lockKey: Schema.String,
				state: Schema.String,
				attemptCount: Schema.Number,
				lastError: Schema.NullOr(Schema.String),
				jobType: Schema.String,
				triggerReason: Schema.String,
			}),
		),
	})
	.middleware(AdminTokenMiddleware);

const listDeadLettersDef = factory.internalQuery({
	payload: {
		source: Schema.optionalWith(
			Schema.Literal("webhook", "bootstrap", "replay"),
			{ default: () => "bootstrap" as const },
		),
		limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
	},
	success: Schema.Array(
		Schema.Struct({
			deliveryId: Schema.String,
			reason: Schema.String,
			payloadJson: Schema.String,
			createdAt: Schema.Number,
			source: Schema.String,
		}),
	),
});

/**
 * Legacy projection repair endpoint. Now a no-op since materialized
 * projection tables have been removed.
 */
const repairProjectionsDef = factory.internalMutation({
	success: Schema.Struct({
		repairedRepoCount: Schema.Number,
	}),
});

/**
 * Queue health summary — webhook event counts by state.
 */
const queueHealthDef = factory.internalQuery({
	success: Schema.Struct({
		pending: Schema.Number,
		retry: Schema.Number,
		processed: Schema.Number,
		failed: Schema.Number,
		deadLetters: Schema.Number,
	}),
});

/**
 * Comprehensive system status for operational dashboard.
 * Includes queue health, processing lag, write op summary,
 * and stale projection detection.
 */
const systemStatusDef = factory
	.query({
		payload: {
			adminToken: Schema.String,
		},
		success: Schema.Struct({
			queue: Schema.Struct({
				pending: Schema.Number,
				retry: Schema.Number,
				failed: Schema.Number,
				deadLetters: Schema.Number,
				recentProcessedLastHour: Schema.Number,
			}),
			processing: Schema.Struct({
				/** Average lag in ms from receivedAt to now for pending events */
				avgPendingLagMs: Schema.NullOr(Schema.Number),
				/** Oldest pending event age in ms */
				maxPendingLagMs: Schema.NullOr(Schema.Number),
				/** Number of events stuck in retry > 5 minutes */
				staleRetryCount: Schema.Number,
			}),
			writeOps: Schema.Struct({
				pending: Schema.Number,
				completed: Schema.Number,
				failed: Schema.Number,
				confirmed: Schema.Number,
			}),
			projections: Schema.Struct({
				/** Number of repos with overview projection */
				overviewCount: Schema.Number,
				/** Number of connected repos */
				repoCount: Schema.Number,
				/** True if every repo has an overview projection */
				allSynced: Schema.Boolean,
			}),
		}),
	})
	.middleware(AdminTokenMiddleware);

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

healthCheckDef.implement((_args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const repos = yield* ctx.db.query("github_repositories").take(1);
		return {
			ok: true,
			tableCount: repos.length,
		};
	}),
);

tableCountsDef.implement((_args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const raw = ctx.rawCtx;

		// Small tables (<10k) — bounded .take() is fine
		const cap = 10001;
		const count = (items: Array<unknown>) => Math.min(items.length, 10000);

		const repositories = yield* ctx.db.query("github_repositories").take(cap);
		const branches = yield* ctx.db.query("github_branches").take(cap);
		const commits = yield* ctx.db.query("github_commits").take(cap);
		const users = yield* ctx.db.query("github_users").take(cap);
		const syncJobs = yield* ctx.db.query("github_sync_jobs").take(cap);
		const installations = yield* ctx.db.query("github_installations").take(cap);

		// Unbounded tables — O(log n) aggregate counts.
		// These aggregates are namespaced, so we iterate repos to sum totals.
		// For a simpler approach, we sum across all known repos.
		const repos = repositories;
		const repoIds = repos.map((r) => r.githubRepoId);

		let pullRequestsTotal = 0;
		let issuesTotal = 0;
		let checkRunsTotal = 0;
		const _issueCommentsTotal = 0;
		const _pullRequestReviewsTotal = 0;
		const _workflowJobsTotal = 0;

		for (const repoId of repoIds) {
			const [prCount, issueCount, checkRunCount] = yield* Effect.promise(() =>
				Promise.all([
					prsByRepo.count(raw, { namespace: repoId }),
					issuesByRepo.count(raw, { namespace: repoId }),
					checkRunsByRepo.count(raw, { namespace: repoId }),
				]),
			);
			pullRequestsTotal += prCount;
			issuesTotal += issueCount;
			checkRunsTotal += checkRunCount;
		}

		// Comments, reviews, and jobs are namespaced by compound keys.
		// Summing across all namespaces isn't practical without listing them.
		// For these, we fall back to bounded .take() since they grow proportionally
		// to their parent entities which are already counted via aggregates.
		const issueCommentsDocs = yield* ctx.db
			.query("github_issue_comments")
			.take(cap);
		const pullRequestReviewsDocs = yield* ctx.db
			.query("github_pull_request_reviews")
			.take(cap);

		// Webhook events — use aggregate by summing known states
		const [webhookPending, webhookProcessed, webhookRetry, webhookFailed] =
			yield* Effect.promise(() =>
				Promise.all([
					webhooksByState.count(raw, { namespace: "pending" }),
					webhooksByState.count(raw, { namespace: "processed" }),
					webhooksByState.count(raw, { namespace: "retry" }),
					webhooksByState.count(raw, { namespace: "failed" }),
				]),
			);

		return {
			repositories: count(repositories),
			branches: count(branches),
			commits: count(commits),
			pullRequests: pullRequestsTotal,
			pullRequestReviews: count(pullRequestReviewsDocs),
			issues: issuesTotal,
			issueComments: count(issueCommentsDocs),
			checkRuns: checkRunsTotal,
			users: count(users),
			syncJobs: count(syncJobs),
			installations: count(installations),
			webhookEvents:
				webhookPending + webhookProcessed + webhookRetry + webhookFailed,
		};
	}),
);

syncJobStatusDef.implement((_args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const jobs = yield* ctx.db.query("github_sync_jobs").collect();
		return jobs.map((j) => ({
			lockKey: j.lockKey,
			state: j.state,
			attemptCount: j.attemptCount,
			lastError: j.lastError,
			jobType: j.jobType,
			triggerReason: j.triggerReason,
		}));
	}),
);

listDeadLettersDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const items = yield* ctx.db
			.query("github_dead_letters")
			.withIndex("by_createdAt")
			.order("desc")
			.take(args.limit);
		return items.map((d) => ({
			deliveryId: d.deliveryId,
			reason: d.reason,
			payloadJson: d.payloadJson,
			createdAt: d.createdAt,
			source: d.source,
		}));
	}),
);

repairProjectionsDef.implement(() =>
	// Materialized projection tables have been removed.
	// This endpoint is kept as a no-op for backward compatibility (cron reference).
	Effect.succeed({ repairedRepoCount: 0 }),
);

queueHealthDef.implement(() =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const raw = ctx.rawCtx;

		// O(log n) counts via webhooksByState aggregate
		const [pending, retry, processed, failed] = yield* Effect.promise(() =>
			Promise.all([
				webhooksByState.count(raw, { namespace: "pending" }),
				webhooksByState.count(raw, { namespace: "retry" }),
				webhooksByState.count(raw, { namespace: "processed" }),
				webhooksByState.count(raw, { namespace: "failed" }),
			]),
		);

		// Dead letters are a separate table, typically small
		const deadLetters = yield* ctx.db
			.query("github_dead_letters")
			.take(10001)
			.pipe(Effect.map((items) => Math.min(items.length, 10000)));

		return {
			pending,
			retry,
			processed,
			failed,
			deadLetters,
		};
	}),
);

systemStatusDef.implement((_args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const raw = ctx.rawCtx;
		const now = Date.now();
		const cap = 10001;
		const count = (items: Array<unknown>) => Math.min(items.length, 10000);

		// -- Queue health (O(log n) via aggregates) --
		const [queuePending, queueRetry, queueFailed] = yield* Effect.promise(() =>
			Promise.all([
				webhooksByState.count(raw, { namespace: "pending" }),
				webhooksByState.count(raw, { namespace: "retry" }),
				webhooksByState.count(raw, { namespace: "failed" }),
			]),
		);

		const deadLetterItems = yield* ctx.db
			.query("github_dead_letters")
			.take(cap);

		// Recent processed in last hour — still needs index range query
		const oneHourAgo = now - 3_600_000;
		const recentProcessed = yield* ctx.db
			.query("github_webhook_events_raw")
			.withIndex("by_processState_and_receivedAt", (q) =>
				q.eq("processState", "processed").gte("receivedAt", oneHourAgo),
			)
			.take(cap);

		// -- Processing lag (from pending events) --
		const pendingEvents = yield* ctx.db
			.query("github_webhook_events_raw")
			.withIndex("by_processState_and_receivedAt", (q) =>
				q.eq("processState", "pending"),
			)
			.take(100);

		let avgPendingLagMs: number | null = null;
		let maxPendingLagMs: number | null = null;
		if (pendingEvents.length > 0) {
			const lags = pendingEvents.map((e) => now - e.receivedAt);
			avgPendingLagMs = Math.round(
				lags.reduce((a, b) => a + b, 0) / lags.length,
			);
			maxPendingLagMs = Math.max(...lags);
		}

		// Stale retries: events in retry state for > 5 minutes
		const fiveMinAgo = now - 300_000;
		const staleRetries = yield* ctx.db
			.query("github_webhook_events_raw")
			.withIndex("by_processState_and_receivedAt", (q) =>
				q.eq("processState", "retry").lte("receivedAt", fiveMinAgo),
			)
			.take(cap);

		// -- Write operations summary (optimistic domain rows) --
		const optimisticIssues = yield* ctx.db.query("github_issues").take(cap);
		const optimisticComments = yield* ctx.db
			.query("github_issue_comments")
			.take(cap);
		const optimisticPrs = yield* ctx.db.query("github_pull_requests").take(cap);
		const optimisticReviews = yield* ctx.db
			.query("github_pull_request_reviews")
			.take(cap);

		const optimisticStates = [
			...optimisticIssues
				.map((row) => row.optimisticState)
				.filter((state) => state !== null && state !== undefined),
			...optimisticComments
				.map((row) => row.optimisticState)
				.filter((state) => state !== null && state !== undefined),
			...optimisticPrs
				.map((row) => row.optimisticState)
				.filter((state) => state !== null && state !== undefined),
			...optimisticReviews
				.map((row) => row.optimisticState)
				.filter((state) => state !== null && state !== undefined),
		];

		const writeOpsPending = optimisticStates.filter(
			(state) => state === "pending",
		).length;
		const writeOpsCompleted = 0;
		const writeOpsFailed = optimisticStates.filter(
			(state) => state === "failed",
		).length;
		const writeOpsConfirmed = optimisticStates.filter(
			(state) => state === "confirmed",
		).length;

		// -- Projection staleness (materialized views removed) --
		const repos = yield* ctx.db.query("github_repositories").take(cap);

		return {
			queue: {
				pending: queuePending,
				retry: queueRetry,
				failed: queueFailed,
				deadLetters: count(deadLetterItems),
				recentProcessedLastHour: count(recentProcessed),
			},
			processing: {
				avgPendingLagMs,
				maxPendingLagMs,
				staleRetryCount: count(staleRetries),
			},
			writeOps: {
				pending: writeOpsPending,
				completed: writeOpsCompleted,
				failed: writeOpsFailed,
				confirmed: writeOpsConfirmed,
			},
			projections: {
				overviewCount: repos.length,
				repoCount: repos.length,
				allSynced: true,
			},
		};
	}),
);

/**
 * Backfill `connectedByUserId` on a repo that was inserted before
 * the migration (or where the field was incorrectly null).
 */
const patchRepoConnectedUserDef = factory.internalMutation({
	payload: {
		githubRepoId: Schema.Number,
		connectedByUserId: Schema.String,
	},
	success: Schema.Boolean,
});

patchRepoConnectedUserDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;
		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_githubRepoId", (q) =>
				q.eq("githubRepoId", args.githubRepoId),
			)
			.first();

		if (Option.isNone(repo)) {
			return false;
		}

		yield* ctx.db.patch(repo.value._id, {
			connectedByUserId: args.connectedByUserId,
		});
		return true;
	}),
);

// ---------------------------------------------------------------------------
// Stuck bootstrap detection and recovery
// ---------------------------------------------------------------------------

const StuckBootstrapInfo = Schema.Struct({
	lockKey: Schema.String,
	repositoryId: Schema.NullOr(Schema.Number),
	state: Schema.String,
	currentStep: Schema.NullOr(Schema.String),
	lastError: Schema.NullOr(Schema.String),
	updatedAt: Schema.Number,
	stuckForMs: Schema.Number,
});

/**
 * Find sync jobs stuck in "running" state for longer than the threshold.
 * Default threshold: 30 minutes.
 */
const listStuckBootstrapsDef = factory.internalQuery({
	payload: {
		/** Stuck threshold in milliseconds. Defaults to 30 minutes. */
		thresholdMs: Schema.optional(Schema.Number),
	},
	success: Schema.Array(StuckBootstrapInfo),
});

listStuckBootstrapsDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const now = Date.now();
		const threshold = args.thresholdMs ?? 30 * 60 * 1000; // 30 min default
		const cutoff = now - threshold;

		const runningJobs = yield* ctx.db
			.query("github_sync_jobs")
			.withIndex("by_state_and_nextRunAt", (q) => q.eq("state", "running"))
			.collect();

		return runningJobs
			.filter((job) => job.updatedAt < cutoff)
			.map((job) => ({
				lockKey: job.lockKey,
				repositoryId: job.repositoryId,
				state: job.state,
				currentStep: job.currentStep ?? null,
				lastError: job.lastError,
				updatedAt: job.updatedAt,
				stuckForMs: now - job.updatedAt,
			}));
	}),
);

/**
 * Mark stuck bootstraps as failed and optionally restart them.
 *
 * For each stuck job:
 * 1. Marks the sync job as "failed" with an explanatory error.
 * 2. If `restart` is true, schedules `startBootstrap` to re-run the
 *    workflow from scratch.
 */
const restartStuckBootstrapsDef = factory.internalMutation({
	payload: {
		/** Stuck threshold in milliseconds. Defaults to 30 minutes. */
		thresholdMs: Schema.optional(Schema.Number),
		/** Whether to restart the jobs after marking them failed. Defaults to true. */
		restart: Schema.optional(Schema.Boolean),
	},
	success: Schema.Struct({
		marked: Schema.Number,
		restarted: Schema.Number,
	}),
});

restartStuckBootstrapsDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;
		const now = Date.now();
		const threshold = args.thresholdMs ?? 30 * 60 * 1000;
		const cutoff = now - threshold;
		const shouldRestart = args.restart ?? true;

		const runningJobs = yield* ctx.db
			.query("github_sync_jobs")
			.withIndex("by_state_and_nextRunAt", (q) => q.eq("state", "running"))
			.collect();

		const stuckJobs = runningJobs.filter((job) => job.updatedAt < cutoff);

		let marked = 0;
		let restarted = 0;

		for (const job of stuckJobs) {
			const stuckMinutes = Math.round((now - job.updatedAt) / 60_000);

			yield* ctx.db.patch(job._id, {
				state: "failed",
				lastError: `Marked as stuck by admin (no update for ${stuckMinutes}m)`,
				updatedAt: now,
			});
			marked++;

			const repoId = job.repositoryId;
			if (shouldRestart && repoId !== null) {
				// Look up the repo to get fullName and connectedByUserId
				const repo = yield* ctx.db
					.query("github_repositories")
					.withIndex("by_githubRepoId", (q) => q.eq("githubRepoId", repoId))
					.first();

				if (Option.isSome(repo)) {
					// Reset the job state so the new workflow can take over
					yield* ctx.db.patch(job._id, {
						state: "pending",
						lastError: null,
						attemptCount: 0,
						currentStep: null,
						completedSteps: [],
						itemsFetched: 0,
						updatedAt: now,
					});

					yield* Effect.promise(() =>
						ctx.rawCtx.scheduler.runAfter(
							0,
							internal.rpc.bootstrapWorkflow.startBootstrap,
							{
								repositoryId: repo.value.githubRepoId,
								fullName: repo.value.fullName,
								lockKey: job.lockKey,
								connectedByUserId: repo.value.connectedByUserId ?? null,
								installationId: repo.value.installationId,
							},
						),
					);
					restarted++;
				}
			}
		}

		return { marked, restarted };
	}),
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const adminModule = makeRpcModule(
	{
		healthCheck: healthCheckDef,
		tableCounts: tableCountsDef,
		syncJobStatus: syncJobStatusDef,
		repairProjections: repairProjectionsDef,
		queueHealth: queueHealthDef,
		systemStatus: systemStatusDef,
		patchRepoConnectedUser: patchRepoConnectedUserDef,
		listStuckBootstraps: listStuckBootstrapsDef,
		restartStuckBootstraps: restartStuckBootstrapsDef,
		listDeadLetters: listDeadLettersDef,
	},
	{ middlewares: DatabaseRpcModuleMiddlewares },
);

export const {
	healthCheck,
	tableCounts,
	syncJobStatus,
	repairProjections,
	queueHealth,
	systemStatus,
	patchRepoConnectedUser,
	listStuckBootstraps,
	restartStuckBootstraps,
	listDeadLetters,
} = adminModule.handlers;
export { adminModule };
export type AdminModule = typeof adminModule;
