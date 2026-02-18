/**
 * Projection builders — update denormalized view tables from normalized domain data.
 *
 * These functions run within mutation context to keep projections consistent
 * with the normalized tables in the same transaction.
 */
import { Effect, Option } from "effect";
import { ConfectMutationCtx } from "../confect";

// ---------------------------------------------------------------------------
// view_repo_overview — per-repo counters + quick status
// ---------------------------------------------------------------------------

export const updateRepoOverview = (repositoryId: number) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;
		const now = Date.now();

		// Get the repository record for metadata
		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_githubRepoId", (q) => q.eq("githubRepoId", repositoryId))
			.first();

		if (Option.isNone(repo)) return;

		const repoDoc = repo.value;

		// Count open PRs
		const openPrs = yield* ctx.db
			.query("github_pull_requests")
			.withIndex("by_repositoryId_and_state_and_githubUpdatedAt", (q) =>
				q.eq("repositoryId", repositoryId).eq("state", "open"),
			)
			.collect();

		// Count open issues
		const openIssues = yield* ctx.db
			.query("github_issues")
			.withIndex("by_repositoryId_and_state_and_githubUpdatedAt", (q) =>
				q.eq("repositoryId", repositoryId).eq("state", "open"),
			)
			.collect();

		// Count failing check runs (conclusion != "success" and conclusion != null)
		const allCheckRuns = yield* ctx.db
			.query("github_check_runs")
			.withIndex("by_repositoryId_and_githubCheckRunId", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		// Group by headSha, only count the latest set of check runs
		// A check run is "failing" if conclusion is not null and not "success" and not "skipped"
		const failingChecks = allCheckRuns.filter(
			(cr) =>
				cr.conclusion !== null &&
				cr.conclusion !== "success" &&
				cr.conclusion !== "skipped" &&
				cr.conclusion !== "neutral",
		);

		const data = {
			repositoryId,
			fullName: repoDoc.fullName,
			ownerLogin: repoDoc.ownerLogin,
			name: repoDoc.name,
			openPrCount: openPrs.length,
			openIssueCount: openIssues.length,
			failingCheckCount: failingChecks.length,
			lastPushAt: repoDoc.pushedAt,
			syncLagSeconds: null as number | null,
			updatedAt: now,
		};

		// Upsert the overview row
		const existing = yield* ctx.db
			.query("view_repo_overview")
			.withIndex("by_repositoryId", (q) => q.eq("repositoryId", repositoryId))
			.first();

		if (Option.isSome(existing)) {
			yield* ctx.db.patch(existing.value._id, data);
		} else {
			yield* ctx.db.insert("view_repo_overview", data);
		}
	});

// ---------------------------------------------------------------------------
// view_repo_pull_request_list — flattened PR list cards
// ---------------------------------------------------------------------------

export const updatePullRequestList = (repositoryId: number) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;

		// Get all PRs for the repo
		const prs = yield* ctx.db
			.query("github_pull_requests")
			.withIndex("by_repositoryId_and_number", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		// Pre-load all users for author lookups
		const userIds = [
			...new Set(prs.map((pr) => pr.authorUserId).filter((id) => id !== null)),
		];
		const userMap = new Map<
			number,
			{ login: string; avatarUrl: string | null }
		>();
		for (const userId of userIds) {
			const user = yield* ctx.db
				.query("github_users")
				.withIndex("by_githubUserId", (q) => q.eq("githubUserId", userId))
				.first();
			if (Option.isSome(user)) {
				userMap.set(userId, {
					login: user.value.login,
					avatarUrl: user.value.avatarUrl,
				});
			}
		}

		// Get reviews and issue comments counts
		const reviews = yield* ctx.db
			.query("github_pull_request_reviews")
			.withIndex("by_repositoryId_and_pullRequestNumber", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		const reviewCountByPr = new Map<number, number>();
		for (const r of reviews) {
			reviewCountByPr.set(
				r.pullRequestNumber,
				(reviewCountByPr.get(r.pullRequestNumber) ?? 0) + 1,
			);
		}

		const comments = yield* ctx.db
			.query("github_issue_comments")
			.withIndex("by_repositoryId_and_issueNumber", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		const commentCountByIssue = new Map<number, number>();
		for (const c of comments) {
			commentCountByIssue.set(
				c.issueNumber,
				(commentCountByIssue.get(c.issueNumber) ?? 0) + 1,
			);
		}

		// Get check runs for latest check conclusion per PR head SHA
		const checkRuns = yield* ctx.db
			.query("github_check_runs")
			.withIndex("by_repositoryId_and_headSha", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		const checkConclusionBySha = new Map<string, string | null>();
		for (const cr of checkRuns) {
			const current = checkConclusionBySha.get(cr.headSha);
			// If any check is failing, mark the SHA as failing
			if (
				cr.conclusion !== null &&
				cr.conclusion !== "success" &&
				cr.conclusion !== "skipped" &&
				cr.conclusion !== "neutral"
			) {
				checkConclusionBySha.set(cr.headSha, cr.conclusion);
			} else if (current === undefined) {
				checkConclusionBySha.set(cr.headSha, cr.conclusion);
			}
		}

		// Delete existing view rows for this repo
		const existingViews = yield* ctx.db
			.query("view_repo_pull_request_list")
			.withIndex("by_repositoryId_and_sortUpdated", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		for (const v of existingViews) {
			yield* ctx.db.delete(v._id);
		}

		// Insert fresh rows
		for (const pr of prs) {
			const author =
				pr.authorUserId !== null ? userMap.get(pr.authorUserId) : undefined;

			yield* ctx.db.insert("view_repo_pull_request_list", {
				repositoryId,
				githubPrId: pr.githubPrId,
				number: pr.number,
				state: pr.state,
				draft: pr.draft,
				title: pr.title,
				authorLogin: author?.login ?? null,
				authorAvatarUrl: author?.avatarUrl ?? null,
				headRefName: pr.headRefName,
				baseRefName: pr.baseRefName,
				commentCount: commentCountByIssue.get(pr.number) ?? 0,
				reviewCount: reviewCountByPr.get(pr.number) ?? 0,
				lastCheckConclusion: checkConclusionBySha.get(pr.headSha) ?? null,
				githubUpdatedAt: pr.githubUpdatedAt,
				sortUpdated: pr.githubUpdatedAt,
			});
		}
	});

// ---------------------------------------------------------------------------
// view_repo_issue_list — flattened issue list cards
// ---------------------------------------------------------------------------

export const updateIssueList = (repositoryId: number) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;

		// Get all issues for the repo (excluding those that are PRs)
		const issues = yield* ctx.db
			.query("github_issues")
			.withIndex("by_repositoryId_and_number", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		const realIssues = issues.filter((i) => !i.isPullRequest);

		// Pre-load users
		const userIds = [
			...new Set(
				realIssues.map((i) => i.authorUserId).filter((id) => id !== null),
			),
		];
		const userMap = new Map<
			number,
			{ login: string; avatarUrl: string | null }
		>();
		for (const userId of userIds) {
			const user = yield* ctx.db
				.query("github_users")
				.withIndex("by_githubUserId", (q) => q.eq("githubUserId", userId))
				.first();
			if (Option.isSome(user)) {
				userMap.set(userId, {
					login: user.value.login,
					avatarUrl: user.value.avatarUrl,
				});
			}
		}

		// Delete existing view rows
		const existingViews = yield* ctx.db
			.query("view_repo_issue_list")
			.withIndex("by_repositoryId_and_sortUpdated", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.collect();

		for (const v of existingViews) {
			yield* ctx.db.delete(v._id);
		}

		// Insert fresh rows
		for (const issue of realIssues) {
			const author =
				issue.authorUserId !== null
					? userMap.get(issue.authorUserId)
					: undefined;

			yield* ctx.db.insert("view_repo_issue_list", {
				repositoryId,
				githubIssueId: issue.githubIssueId,
				number: issue.number,
				state: issue.state,
				title: issue.title,
				authorLogin: author?.login ?? null,
				authorAvatarUrl: author?.avatarUrl ?? null,
				labelNames: [...issue.labelNames],
				commentCount: issue.commentCount,
				githubUpdatedAt: issue.githubUpdatedAt,
				sortUpdated: issue.githubUpdatedAt,
			});
		}
	});

// ---------------------------------------------------------------------------
// view_activity_feed — normalized activity events from webhook events
// ---------------------------------------------------------------------------

export const appendActivityFeedEntry = (
	repositoryId: number,
	installationId: number,
	activityType: string,
	title: string,
	description: string | null,
	actorLogin: string | null,
	actorAvatarUrl: string | null,
	entityNumber: number | null,
) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectMutationCtx;
		yield* ctx.db.insert("view_activity_feed", {
			repositoryId,
			installationId,
			activityType,
			title,
			description,
			actorLogin,
			actorAvatarUrl,
			entityNumber,
			createdAt: Date.now(),
		});
	});

// ---------------------------------------------------------------------------
// Combined projection update — call after any domain data change
// ---------------------------------------------------------------------------

export const updateAllProjections = (repositoryId: number) =>
	Effect.gen(function* () {
		yield* updateRepoOverview(repositoryId);
		yield* updatePullRequestList(repositoryId);
		yield* updateIssueList(repositoryId);
		// Activity feed is append-only — handled separately per event
	});
