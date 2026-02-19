/**
 * bootstrapSteps — Individual step actions for the durable bootstrap workflow.
 *
 * Each step fetches one category of data from the GitHub API and writes it
 * to the DB via bootstrapWrite mutations. They return lightweight summaries
 * so the workflow journal stays well within the 1 MiB limit.
 *
 * These are vanilla Convex `internalAction`s (not Confect) because they are
 * called by the workflow engine via `step.runAction()`.
 *
 * Errors are allowed to throw (via `Effect.runPromise` + `Effect.orDie`).
 * The workflow's retry policy handles transient failures like rate limits.
 */
import { v } from "convex/values";
import { Effect } from "effect";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { GitHubApiClient, GitHubApiError } from "../shared/githubApi";

// ---------------------------------------------------------------------------
// GitHub response parsing helpers (shared with repoBootstrapImpl)
// ---------------------------------------------------------------------------

const parseNextLink = (linkHeader: string | null): string | null => {
	if (!linkHeader) return null;
	const matches = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
	return matches?.[1] ?? null;
};

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

const isoToMs = (v: unknown): number | null => {
	if (typeof v !== "string") return null;
	const ms = new Date(v).getTime();
	return Number.isNaN(ms) ? null : ms;
};

const userType = (v: unknown): "User" | "Bot" | "Organization" =>
	v === "Bot" ? "Bot" : v === "Organization" ? "Organization" : "User";

// ---------------------------------------------------------------------------
// Shared user collector
// ---------------------------------------------------------------------------

type CollectedUser = {
	githubUserId: number;
	login: string;
	avatarUrl: string | null;
	siteAdmin: boolean;
	type: "User" | "Bot" | "Organization";
};

const createUserCollector = () => {
	const userMap = new Map<number, CollectedUser>();

	const collectUser = (u: unknown): number | null => {
		if (
			u !== null &&
			u !== undefined &&
			typeof u === "object" &&
			"id" in u &&
			"login" in u
		) {
			const id = num(u.id);
			const login = str(u.login);
			if (id !== null && login !== null && !userMap.has(id)) {
				userMap.set(id, {
					githubUserId: id,
					login,
					avatarUrl: "avatar_url" in u ? str(u.avatar_url) : null,
					siteAdmin: "site_admin" in u ? u.site_admin === true : false,
					type: "type" in u ? userType(u.type) : "User",
				});
			}
			return id;
		}
		return null;
	};

	return { collectUser, getUsers: () => [...userMap.values()] };
};

// ---------------------------------------------------------------------------
// Helper: run Effect with GitHubApiClient, converting errors to throws
// so the workflow retry policy handles them.
// ---------------------------------------------------------------------------

const runWithGitHub = <A>(
	effect: Effect.Effect<A, never, GitHubApiClient>,
): Promise<A> =>
	Effect.runPromise(Effect.provide(effect, GitHubApiClient.Live));

// ---------------------------------------------------------------------------
// Helper: write users in batches
// ---------------------------------------------------------------------------

type ActionCtx = {
	runMutation: <T>(
		reference: import("convex/server").FunctionReference<
			"mutation",
			"internal"
		>,
		args: Record<string, unknown>,
	) => Promise<T>;
};

const writeUsers = async (ctx: ActionCtx, users: Array<CollectedUser>) => {
	for (let i = 0; i < users.length; i += 50) {
		await ctx.runMutation(internal.rpc.bootstrapWrite.upsertUsers, {
			users: users.slice(i, i + 50),
		});
	}
};

// ---------------------------------------------------------------------------
// Step 1: Fetch branches
// ---------------------------------------------------------------------------

export const fetchBranches = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
	},
	returns: v.object({ count: v.number() }),
	handler: async (ctx, args): Promise<{ count: number }> => {
		const rawBranches = await runWithGitHub(
			Effect.gen(function* () {
				const gh = yield* GitHubApiClient;
				return yield* gh.use(async (fetch) => {
					const res = await fetch(
						`/repos/${args.fullName}/branches?per_page=100`,
					);
					if (!res.ok)
						throw new GitHubApiError({
							status: res.status,
							message: await res.text(),
							url: res.url,
						});
					return (await res.json()) as Array<Record<string, unknown>>;
				});
			}).pipe(Effect.orDie),
		);

		const branches = rawBranches.map((b) => ({
			name: str(b.name) ?? "unknown",
			headSha:
				str(
					typeof b.commit === "object" && b.commit !== null && "sha" in b.commit
						? b.commit.sha
						: null,
				) ?? "",
			protected: b.protected === true,
		}));

		await ctx.runMutation(internal.rpc.bootstrapWrite.upsertBranches, {
			repositoryId: args.repositoryId,
			branches,
		});

		return { count: branches.length };
	},
});

// ---------------------------------------------------------------------------
// Step 2: Fetch pull requests (paginated)
// ---------------------------------------------------------------------------

export const fetchPullRequests = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
	},
	returns: v.object({
		count: v.number(),
		openPrSyncTargets: v.array(
			v.object({
				pullRequestNumber: v.number(),
				headSha: v.string(),
			}),
		),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{
		count: number;
		openPrSyncTargets: Array<{
			pullRequestNumber: number;
			headSha: string;
		}>;
	}> => {
		// Stream page-by-page to avoid OOM on large repos (e.g. oven-sh/bun
		// has 14k+ PRs). Each page is transformed, written to the DB, and
		// discarded before fetching the next page.
		const { collectUser, getUsers } = createUserCollector();
		let totalCount = 0;
		const openPrSyncTargets: Array<{
			pullRequestNumber: number;
			headSha: string;
		}> = [];

		// We use a plain async loop so we can interleave GitHub fetches
		// (via Effect) with Convex mutation writes (via ctx.runMutation).
		// Resolve the GitHubApiClient service once, then reuse its .use()
		// method for each page — avoids re-creating the token layer each time.
		const gh = await runWithGitHub(
			Effect.gen(function* () {
				return yield* GitHubApiClient;
			}),
		);

		let url: string | null =
			`/repos/${args.fullName}/pulls?state=all&per_page=100`;

		while (url) {
			// Fetch one page — gh.use() returns Effect<A, Error, never>
			// so we can run it directly without providing a layer.
			const { page, nextUrl } = await Effect.runPromise(
				gh
					.use(async (fetch) => {
						const res = await fetch(url!);
						if (!res.ok)
							throw new GitHubApiError({
								status: res.status,
								message: await res.text(),
								url: res.url,
							});
						return {
							page: (await res.json()) as Array<Record<string, unknown>>,
							nextUrl: parseNextLink(res.headers.get("Link")),
						};
					})
					.pipe(Effect.orDie),
			);

			// Transform the page
			const pullRequests = page.map((pr) => {
				const authorUserId = collectUser(pr.user);
				const head =
					typeof pr.head === "object" && pr.head !== null
						? (pr.head as Record<string, unknown>)
						: {};
				const base =
					typeof pr.base === "object" && pr.base !== null
						? (pr.base as Record<string, unknown>)
						: {};

				return {
					githubPrId: num(pr.id) ?? 0,
					number: num(pr.number) ?? 0,
					state: (pr.state === "open" ? "open" : "closed") as "open" | "closed",
					draft: pr.draft === true,
					title: str(pr.title) ?? "",
					body: str(pr.body),
					authorUserId,
					assigneeUserIds: [] as Array<number>,
					requestedReviewerUserIds: [] as Array<number>,
					baseRefName: str(base.ref) ?? "",
					headRefName: str(head.ref) ?? "",
					headSha: str(head.sha) ?? "",
					mergeableState: str(pr.mergeable_state),
					mergedAt: isoToMs(pr.merged_at),
					closedAt: isoToMs(pr.closed_at),
					githubUpdatedAt: isoToMs(pr.updated_at) ?? Date.now(),
				};
			});

			// Write this page's PRs to the DB immediately (batches of 50).
			// skipProjections=true avoids expensive full-table projection
			// rebuilds during bulk import — projections are rebuilt once
			// at the end of the workflow via onBootstrapComplete.
			for (let i = 0; i < pullRequests.length; i += 50) {
				await ctx.runMutation(internal.rpc.bootstrapWrite.upsertPullRequests, {
					repositoryId: args.repositoryId,
					pullRequests: pullRequests.slice(i, i + 50),
					skipProjections: true,
				});
			}

			// Track open PRs for file sync (only open PRs, small list)
			for (const pr of pullRequests) {
				if (pr.state === "open" && pr.headSha !== "") {
					openPrSyncTargets.push({
						pullRequestNumber: pr.number,
						headSha: pr.headSha,
					});
				}
			}

			totalCount += pullRequests.length;
			url = nextUrl;
		}

		// Write collected users (accumulated across all pages, but these are
		// much smaller — one entry per unique user)
		await writeUsers(ctx, getUsers());

		return { count: totalCount, openPrSyncTargets };
	},
});

// ---------------------------------------------------------------------------
// Step 3: Fetch issues (paginated, excludes PRs)
// ---------------------------------------------------------------------------

export const fetchIssues = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
	},
	returns: v.object({ count: v.number() }),
	handler: async (ctx, args): Promise<{ count: number }> => {
		// Stream page-by-page to avoid OOM on large repos (e.g. oven-sh/bun
		// has 10k+ issues). Each page is transformed, written, and discarded.
		const { collectUser, getUsers } = createUserCollector();
		let totalCount = 0;

		const gh = await runWithGitHub(
			Effect.gen(function* () {
				return yield* GitHubApiClient;
			}),
		);

		let url: string | null =
			`/repos/${args.fullName}/issues?state=all&per_page=100`;

		while (url) {
			// Fetch one page
			const { page, nextUrl } = await Effect.runPromise(
				gh
					.use(async (fetch) => {
						const res = await fetch(url!);
						if (!res.ok)
							throw new GitHubApiError({
								status: res.status,
								message: await res.text(),
								url: res.url,
							});
						return {
							page: (await res.json()) as Array<Record<string, unknown>>,
							nextUrl: parseNextLink(res.headers.get("Link")),
						};
					})
					.pipe(Effect.orDie),
			);

			// GitHub's issues API includes PRs — filter them out, then transform
			const issues = page
				.filter((item) => !("pull_request" in item))
				.map((issue) => {
					const authorUserId = collectUser(issue.user);
					const labels = Array.isArray(issue.labels)
						? issue.labels
								.map((l: unknown) =>
									typeof l === "object" &&
									l !== null &&
									"name" in l &&
									typeof l.name === "string"
										? l.name
										: null,
								)
								.filter((n: string | null): n is string => n !== null)
						: [];

					return {
						githubIssueId: num(issue.id) ?? 0,
						number: num(issue.number) ?? 0,
						state: (issue.state === "open" ? "open" : "closed") as
							| "open"
							| "closed",
						title: str(issue.title) ?? "",
						body: str(issue.body),
						authorUserId,
						assigneeUserIds: [] as Array<number>,
						labelNames: labels,
						commentCount: num(issue.comments) ?? 0,
						isPullRequest: false,
						closedAt: isoToMs(issue.closed_at),
						githubUpdatedAt: isoToMs(issue.updated_at) ?? Date.now(),
					};
				});

			// Write this page's issues to the DB immediately.
			// skipProjections=true — projections rebuilt at end of workflow.
			for (let i = 0; i < issues.length; i += 50) {
				await ctx.runMutation(internal.rpc.bootstrapWrite.upsertIssues, {
					repositoryId: args.repositoryId,
					issues: issues.slice(i, i + 50),
					skipProjections: true,
				});
			}

			totalCount += issues.length;
			url = nextUrl;
		}

		// Write collected users
		await writeUsers(ctx, getUsers());

		return { count: totalCount };
	},
});

// ---------------------------------------------------------------------------
// Step 4: Fetch recent commits (first page only)
// ---------------------------------------------------------------------------

export const fetchCommits = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
	},
	returns: v.object({ count: v.number() }),
	handler: async (ctx, args): Promise<{ count: number }> => {
		const { collectUser, getUsers } = createUserCollector();

		const allCommits = await runWithGitHub(
			Effect.gen(function* () {
				const gh = yield* GitHubApiClient;
				return yield* gh.use(async (fetch) => {
					const res = await fetch(
						`/repos/${args.fullName}/commits?per_page=100`,
					);
					if (!res.ok)
						throw new GitHubApiError({
							status: res.status,
							message: await res.text(),
							url: res.url,
						});
					return (await res.json()) as Array<Record<string, unknown>>;
				});
			}).pipe(Effect.orDie),
		);

		const commits = allCommits.map((c) => {
			const commit =
				typeof c.commit === "object" && c.commit !== null
					? (c.commit as Record<string, unknown>)
					: {};
			const author =
				typeof commit.author === "object" && commit.author !== null
					? (commit.author as Record<string, unknown>)
					: {};
			const committer =
				typeof commit.committer === "object" && commit.committer !== null
					? (commit.committer as Record<string, unknown>)
					: {};

			const authorUserId = collectUser(c.author);
			const committerUserId = collectUser(c.committer);
			const message = str(commit.message) ?? "";

			return {
				sha: str(c.sha) ?? "",
				authorUserId,
				committerUserId,
				messageHeadline: message.split("\n")[0] ?? "",
				authoredAt: isoToMs(author.date),
				committedAt: isoToMs(committer.date),
				additions: null as number | null,
				deletions: null as number | null,
				changedFiles: null as number | null,
			};
		});

		// Write commits in batches
		for (let i = 0; i < commits.length; i += 50) {
			await ctx.runMutation(internal.rpc.bootstrapWrite.upsertCommits, {
				repositoryId: args.repositoryId,
				commits: commits.slice(i, i + 50),
			});
		}

		// Write collected users
		await writeUsers(ctx, getUsers());

		return { count: commits.length };
	},
});

// ---------------------------------------------------------------------------
// Step 5: Fetch check runs for active PR head SHAs
// ---------------------------------------------------------------------------

export const fetchCheckRuns = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
		headShas: v.array(v.string()),
	},
	returns: v.object({ count: v.number() }),
	handler: async (ctx, args): Promise<{ count: number }> => {
		const allCheckRuns = await runWithGitHub(
			Effect.gen(function* () {
				const gh = yield* GitHubApiClient;
				const results: Array<{
					githubCheckRunId: number;
					name: string;
					headSha: string;
					status: string;
					conclusion: string | null;
					startedAt: number | null;
					completedAt: number | null;
				}> = [];

				for (const sha of args.headShas) {
					const shaCheckRuns = yield* gh.use(async (fetch) => {
						const res = await fetch(
							`/repos/${args.fullName}/commits/${sha}/check-runs?per_page=100`,
						);
						if (!res.ok) {
							// Non-critical — some repos may not have check runs
							if (res.status === 404)
								return [] as Array<{
									githubCheckRunId: number;
									name: string;
									headSha: string;
									status: string;
									conclusion: string | null;
									startedAt: number | null;
									completedAt: number | null;
								}>;
							throw new GitHubApiError({
								status: res.status,
								message: await res.text(),
								url: res.url,
							});
						}
						const data = (await res.json()) as Record<string, unknown>;
						const checkRuns = Array.isArray(data.check_runs)
							? data.check_runs
							: [];
						const parsed: Array<{
							githubCheckRunId: number;
							name: string;
							headSha: string;
							status: string;
							conclusion: string | null;
							startedAt: number | null;
							completedAt: number | null;
						}> = [];
						for (const cr of checkRuns) {
							const crObj =
								typeof cr === "object" && cr !== null
									? (cr as Record<string, unknown>)
									: {};
							const id = num(crObj.id);
							const name = str(crObj.name);
							if (id !== null && name !== null) {
								parsed.push({
									githubCheckRunId: id,
									name,
									headSha: sha,
									status: str(crObj.status) ?? "queued",
									conclusion: str(crObj.conclusion),
									startedAt: isoToMs(crObj.started_at),
									completedAt: isoToMs(crObj.completed_at),
								});
							}
						}
						return parsed;
					});
					results.push(...shaCheckRuns);
				}
				return results;
			}).pipe(Effect.orDie),
		);

		// Write check runs in batches
		for (let i = 0; i < allCheckRuns.length; i += 50) {
			await ctx.runMutation(internal.rpc.bootstrapWrite.upsertCheckRuns, {
				repositoryId: args.repositoryId,
				checkRuns: allCheckRuns.slice(i, i + 50),
			});
		}

		return { count: allCheckRuns.length };
	},
});

// ---------------------------------------------------------------------------
// Step 6: Fetch workflow runs + jobs
// ---------------------------------------------------------------------------

export const fetchWorkflowRuns = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
	},
	returns: v.object({
		runCount: v.number(),
		jobCount: v.number(),
	}),
	handler: async (
		ctx,
		args,
	): Promise<{ runCount: number; jobCount: number }> => {
		const { collectUser, getUsers } = createUserCollector();

		const { workflowRuns, workflowJobs } = await runWithGitHub(
			Effect.gen(function* () {
				const gh = yield* GitHubApiClient;

				// --- Fetch workflow runs ---
				type WfRun = {
					githubRunId: number;
					workflowId: number;
					workflowName: string | null;
					runNumber: number;
					runAttempt: number;
					event: string;
					status: string | null;
					conclusion: string | null;
					headBranch: string | null;
					headSha: string;
					actorUserId: number | null;
					htmlUrl: string | null;
					createdAt: number;
					updatedAt: number;
				};

				const allWorkflowRuns: Array<WfRun> = yield* gh.use(async (fetch) => {
					const res = await fetch(
						`/repos/${args.fullName}/actions/runs?per_page=100`,
					);
					if (!res.ok) {
						if (res.status === 404) return [];
						throw new GitHubApiError({
							status: res.status,
							message: await res.text(),
							url: res.url,
						});
					}
					const data = (await res.json()) as Record<string, unknown>;
					const runs = Array.isArray(data.workflow_runs)
						? data.workflow_runs
						: [];
					const parsed: Array<WfRun> = [];
					for (const r of runs) {
						const rObj =
							typeof r === "object" && r !== null
								? (r as Record<string, unknown>)
								: {};
						const id = num(rObj.id);
						const wfId = num(rObj.workflow_id);
						const runNumber = num(rObj.run_number);
						if (id !== null && wfId !== null && runNumber !== null) {
							const actorUserId = collectUser(rObj.actor);
							parsed.push({
								githubRunId: id,
								workflowId: wfId,
								workflowName: str(rObj.name),
								runNumber,
								runAttempt: num(rObj.run_attempt) ?? 1,
								event: str(rObj.event) ?? "unknown",
								status: str(rObj.status),
								conclusion: str(rObj.conclusion),
								headBranch: str(rObj.head_branch),
								headSha: str(rObj.head_sha) ?? "",
								actorUserId,
								htmlUrl: str(rObj.html_url),
								createdAt: isoToMs(rObj.created_at) ?? Date.now(),
								updatedAt: isoToMs(rObj.updated_at) ?? Date.now(),
							});
						}
					}
					return parsed;
				});

				// --- Fetch jobs for recent/active workflow runs ---
				const activeRunIds = allWorkflowRuns
					.filter(
						(r) =>
							r.status === "in_progress" ||
							r.status === "queued" ||
							r.conclusion !== null,
					)
					.slice(0, 20)
					.map((r) => r.githubRunId);

				type WfJob = {
					githubJobId: number;
					githubRunId: number;
					name: string;
					status: string;
					conclusion: string | null;
					startedAt: number | null;
					completedAt: number | null;
					runnerName: string | null;
					stepsJson: string | null;
				};

				const allWorkflowJobs: Array<WfJob> = [];

				for (const runId of activeRunIds) {
					const jobs = yield* gh.use(async (fetch) => {
						const res = await fetch(
							`/repos/${args.fullName}/actions/runs/${runId}/jobs?per_page=100`,
						);
						if (!res.ok) {
							if (res.status === 404) return [] as Array<WfJob>;
							throw new GitHubApiError({
								status: res.status,
								message: await res.text(),
								url: res.url,
							});
						}
						const data = (await res.json()) as Record<string, unknown>;
						const jobsList = Array.isArray(data.jobs) ? data.jobs : [];
						const parsed: Array<WfJob> = [];
						for (const j of jobsList) {
							const jObj =
								typeof j === "object" && j !== null
									? (j as Record<string, unknown>)
									: {};
							const jobId = num(jObj.id);
							const name = str(jObj.name);
							if (jobId !== null && name !== null) {
								parsed.push({
									githubJobId: jobId,
									githubRunId: runId,
									name,
									status: str(jObj.status) ?? "queued",
									conclusion: str(jObj.conclusion),
									startedAt: isoToMs(jObj.started_at),
									completedAt: isoToMs(jObj.completed_at),
									runnerName: str(jObj.runner_name),
									stepsJson: Array.isArray(jObj.steps)
										? JSON.stringify(jObj.steps)
										: null,
								});
							}
						}
						return parsed;
					});
					allWorkflowJobs.push(...jobs);
				}

				return {
					workflowRuns: allWorkflowRuns,
					workflowJobs: allWorkflowJobs,
				};
			}).pipe(Effect.orDie),
		);

		// Write workflow runs in batches
		for (let i = 0; i < workflowRuns.length; i += 50) {
			await ctx.runMutation(internal.rpc.bootstrapWrite.upsertWorkflowRuns, {
				repositoryId: args.repositoryId,
				workflowRuns: workflowRuns.slice(i, i + 50),
			});
		}

		// Write workflow jobs in batches
		for (let i = 0; i < workflowJobs.length; i += 50) {
			await ctx.runMutation(internal.rpc.bootstrapWrite.upsertWorkflowJobs, {
				repositoryId: args.repositoryId,
				workflowJobs: workflowJobs.slice(i, i + 50),
			});
		}

		// Write collected users
		await writeUsers(ctx, getUsers());

		return {
			runCount: workflowRuns.length,
			jobCount: workflowJobs.length,
		};
	},
});

// ---------------------------------------------------------------------------
// Step 7: Schedule PR file syncs
// ---------------------------------------------------------------------------

export const schedulePrFileSyncs = internalAction({
	args: {
		repositoryId: v.number(),
		fullName: v.string(),
		openPrSyncTargets: v.array(
			v.object({
				pullRequestNumber: v.number(),
				headSha: v.string(),
			}),
		),
	},
	returns: v.object({ scheduled: v.number() }),
	handler: async (ctx, args): Promise<{ scheduled: number }> => {
		const [ownerLogin, repoName] = args.fullName.split("/");
		if (!ownerLogin || !repoName) return { scheduled: 0 };

		for (const pr of args.openPrSyncTargets) {
			await ctx.scheduler.runAfter(0, internal.rpc.githubActions.syncPrFiles, {
				ownerLogin,
				name: repoName,
				repositoryId: args.repositoryId,
				pullRequestNumber: pr.pullRequestNumber,
				headSha: pr.headSha,
			});
		}

		return { scheduled: args.openPrSyncTargets.length };
	},
});
