import { createRpcFactory, makeRpcModule } from "@packages/confect/rpc";
import { Array as Arr, Effect, Option, Predicate, Schema } from "effect";
import { ConfectQueryCtx, confectSchema } from "../confect";
import { DatabaseRpcTelemetryLayer } from "./telemetry";

const factory = createRpcFactory({ schema: confectSchema });

// ---------------------------------------------------------------------------
// Endpoint definitions
// ---------------------------------------------------------------------------

/**
 * Get all connected repositories with their overview stats.
 */
const listReposDef = factory.query({
	success: Schema.Array(
		Schema.Struct({
			repositoryId: Schema.Number,
			fullName: Schema.String,
			ownerLogin: Schema.String,
			name: Schema.String,
			openPrCount: Schema.Number,
			openIssueCount: Schema.Number,
			failingCheckCount: Schema.Number,
			lastPushAt: Schema.NullOr(Schema.Number),
			updatedAt: Schema.Number,
		}),
	),
});

/**
 * Get a single repo overview by owner/name.
 */
const getRepoOverviewDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
	},
	success: Schema.NullOr(
		Schema.Struct({
			repositoryId: Schema.Number,
			fullName: Schema.String,
			ownerLogin: Schema.String,
			name: Schema.String,
			openPrCount: Schema.Number,
			openIssueCount: Schema.Number,
			failingCheckCount: Schema.Number,
			lastPushAt: Schema.NullOr(Schema.Number),
			updatedAt: Schema.Number,
		}),
	),
});

/**
 * Get pull request list for a repository.
 */
const listPullRequestsDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
		state: Schema.optional(Schema.Literal("open", "closed")),
	},
	success: Schema.Array(
		Schema.Struct({
			number: Schema.Number,
			state: Schema.Literal("open", "closed"),
			draft: Schema.Boolean,
			title: Schema.String,
			authorLogin: Schema.NullOr(Schema.String),
			authorAvatarUrl: Schema.NullOr(Schema.String),
			headRefName: Schema.String,
			baseRefName: Schema.String,
			commentCount: Schema.Number,
			reviewCount: Schema.Number,
			lastCheckConclusion: Schema.NullOr(Schema.String),
			githubUpdatedAt: Schema.Number,
		}),
	),
});

/**
 * Get issue list for a repository.
 */
const listIssuesDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
		state: Schema.optional(Schema.Literal("open", "closed")),
	},
	success: Schema.Array(
		Schema.Struct({
			number: Schema.Number,
			state: Schema.Literal("open", "closed"),
			title: Schema.String,
			authorLogin: Schema.NullOr(Schema.String),
			authorAvatarUrl: Schema.NullOr(Schema.String),
			labelNames: Schema.Array(Schema.String),
			commentCount: Schema.Number,
			githubUpdatedAt: Schema.Number,
		}),
	),
});

/**
 * Get activity feed for a repository.
 */
const listActivityDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
		limit: Schema.optional(Schema.Number),
	},
	success: Schema.Array(
		Schema.Struct({
			activityType: Schema.String,
			title: Schema.String,
			description: Schema.NullOr(Schema.String),
			actorLogin: Schema.NullOr(Schema.String),
			actorAvatarUrl: Schema.NullOr(Schema.String),
			entityNumber: Schema.NullOr(Schema.Number),
			createdAt: Schema.Number,
		}),
	),
});

// -- Shared sub-schemas for detail views ------------------------------------

const CommentSchema = Schema.Struct({
	githubCommentId: Schema.Number,
	authorLogin: Schema.NullOr(Schema.String),
	authorAvatarUrl: Schema.NullOr(Schema.String),
	body: Schema.String,
	createdAt: Schema.Number,
	updatedAt: Schema.Number,
});

const ReviewSchema = Schema.Struct({
	githubReviewId: Schema.Number,
	authorLogin: Schema.NullOr(Schema.String),
	authorAvatarUrl: Schema.NullOr(Schema.String),
	state: Schema.String,
	submittedAt: Schema.NullOr(Schema.Number),
});

const CheckRunSchema = Schema.Struct({
	name: Schema.String,
	status: Schema.String,
	conclusion: Schema.NullOr(Schema.String),
	startedAt: Schema.NullOr(Schema.Number),
	completedAt: Schema.NullOr(Schema.Number),
});

/**
 * Get full issue detail including body and comments.
 */
const getIssueDetailDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
		number: Schema.Number,
	},
	success: Schema.NullOr(
		Schema.Struct({
			number: Schema.Number,
			state: Schema.Literal("open", "closed"),
			title: Schema.String,
			body: Schema.NullOr(Schema.String),
			authorLogin: Schema.NullOr(Schema.String),
			authorAvatarUrl: Schema.NullOr(Schema.String),
			labelNames: Schema.Array(Schema.String),
			commentCount: Schema.Number,
			closedAt: Schema.NullOr(Schema.Number),
			githubUpdatedAt: Schema.Number,
			comments: Schema.Array(CommentSchema),
		}),
	),
});

/**
 * Get full pull request detail including body, comments, reviews, and check runs.
 */
const getPullRequestDetailDef = factory.query({
	payload: {
		ownerLogin: Schema.String,
		name: Schema.String,
		number: Schema.Number,
	},
	success: Schema.NullOr(
		Schema.Struct({
			number: Schema.Number,
			state: Schema.Literal("open", "closed"),
			draft: Schema.Boolean,
			title: Schema.String,
			body: Schema.NullOr(Schema.String),
			authorLogin: Schema.NullOr(Schema.String),
			authorAvatarUrl: Schema.NullOr(Schema.String),
			headRefName: Schema.String,
			baseRefName: Schema.String,
			headSha: Schema.String,
			mergeableState: Schema.NullOr(Schema.String),
			mergedAt: Schema.NullOr(Schema.Number),
			closedAt: Schema.NullOr(Schema.Number),
			githubUpdatedAt: Schema.Number,
			comments: Schema.Array(CommentSchema),
			reviews: Schema.Array(ReviewSchema),
			checkRuns: Schema.Array(CheckRunSchema),
		}),
	),
});

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

listReposDef.implement(() =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const overviews = yield* ctx.db.query("view_repo_overview").collect();
		return overviews.map((o) => ({
			repositoryId: o.repositoryId,
			fullName: o.fullName,
			ownerLogin: o.ownerLogin,
			name: o.name,
			openPrCount: o.openPrCount,
			openIssueCount: o.openIssueCount,
			failingCheckCount: o.failingCheckCount,
			lastPushAt: o.lastPushAt,
			updatedAt: o.updatedAt,
		}));
	}),
);

getRepoOverviewDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;

		// Look up repo by owner/name to get repositoryId
		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_ownerLogin_and_name", (q) =>
				q.eq("ownerLogin", args.ownerLogin).eq("name", args.name),
			)
			.first();

		if (Option.isNone(repo)) return null;

		const overview = yield* ctx.db
			.query("view_repo_overview")
			.withIndex("by_repositoryId", (q) =>
				q.eq("repositoryId", repo.value.githubRepoId),
			)
			.first();

		if (Option.isNone(overview)) return null;

		const o = overview.value;
		return {
			repositoryId: o.repositoryId,
			fullName: o.fullName,
			ownerLogin: o.ownerLogin,
			name: o.name,
			openPrCount: o.openPrCount,
			openIssueCount: o.openIssueCount,
			failingCheckCount: o.failingCheckCount,
			lastPushAt: o.lastPushAt,
			updatedAt: o.updatedAt,
		};
	}),
);

listPullRequestsDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;

		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_ownerLogin_and_name", (q) =>
				q.eq("ownerLogin", args.ownerLogin).eq("name", args.name),
			)
			.first();

		if (Option.isNone(repo)) return [];

		const repositoryId = repo.value.githubRepoId;
		const allPrs = yield* ctx.db
			.query("view_repo_pull_request_list")
			.withIndex("by_repositoryId_and_sortUpdated", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.order("desc")
			.collect();

		const filtered =
			args.state !== undefined
				? allPrs.filter((pr) => pr.state === args.state)
				: allPrs;

		return filtered.map((pr) => ({
			number: pr.number,
			state: pr.state,
			draft: pr.draft,
			title: pr.title,
			authorLogin: pr.authorLogin,
			authorAvatarUrl: pr.authorAvatarUrl,
			headRefName: pr.headRefName,
			baseRefName: pr.baseRefName,
			commentCount: pr.commentCount,
			reviewCount: pr.reviewCount,
			lastCheckConclusion: pr.lastCheckConclusion,
			githubUpdatedAt: pr.githubUpdatedAt,
		}));
	}),
);

listIssuesDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;

		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_ownerLogin_and_name", (q) =>
				q.eq("ownerLogin", args.ownerLogin).eq("name", args.name),
			)
			.first();

		if (Option.isNone(repo)) return [];

		const repositoryId = repo.value.githubRepoId;
		const allIssues = yield* ctx.db
			.query("view_repo_issue_list")
			.withIndex("by_repositoryId_and_sortUpdated", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.order("desc")
			.collect();

		const filtered =
			args.state !== undefined
				? allIssues.filter((i) => i.state === args.state)
				: allIssues;

		return filtered.map((i) => ({
			number: i.number,
			state: i.state,
			title: i.title,
			authorLogin: i.authorLogin,
			authorAvatarUrl: i.authorAvatarUrl,
			labelNames: [...i.labelNames],
			commentCount: i.commentCount,
			githubUpdatedAt: i.githubUpdatedAt,
		}));
	}),
);

listActivityDef.implement((args) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;

		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_ownerLogin_and_name", (q) =>
				q.eq("ownerLogin", args.ownerLogin).eq("name", args.name),
			)
			.first();

		if (Option.isNone(repo)) return [];

		const repositoryId = repo.value.githubRepoId;
		const limit = args.limit ?? 50;
		const activities = yield* ctx.db
			.query("view_activity_feed")
			.withIndex("by_repositoryId_and_createdAt", (q) =>
				q.eq("repositoryId", repositoryId),
			)
			.order("desc")
			.take(limit);

		return activities.map((a) => ({
			activityType: a.activityType,
			title: a.title,
			description: a.description,
			actorLogin: a.actorLogin,
			actorAvatarUrl: a.actorAvatarUrl,
			entityNumber: a.entityNumber,
			createdAt: a.createdAt,
		}));
	}),
);

// -- Helper: resolve GitHub user login + avatar by userId -------------------

const resolveUser = (userId: number | null) =>
	Effect.gen(function* () {
		if (userId === null) return { login: null, avatarUrl: null };
		const ctx = yield* ConfectQueryCtx;
		const user = yield* ctx.db
			.query("github_users")
			.withIndex("by_githubUserId", (q) => q.eq("githubUserId", userId))
			.first();
		if (Option.isNone(user)) return { login: null, avatarUrl: null };
		return { login: user.value.login, avatarUrl: user.value.avatarUrl };
	});

// -- Helper: find repo by owner/name and return repositoryId ----------------

const findRepo = (ownerLogin: string, name: string) =>
	Effect.gen(function* () {
		const ctx = yield* ConfectQueryCtx;
		const repo = yield* ctx.db
			.query("github_repositories")
			.withIndex("by_ownerLogin_and_name", (q) =>
				q.eq("ownerLogin", ownerLogin).eq("name", name),
			)
			.first();
		if (Option.isNone(repo)) return null;
		return repo.value.githubRepoId;
	});

getIssueDetailDef.implement((args) =>
	Effect.gen(function* () {
		const repositoryId = yield* findRepo(args.ownerLogin, args.name);
		if (repositoryId === null) return null;

		const ctx = yield* ConfectQueryCtx;

		// Get the issue
		const issueOpt = yield* ctx.db
			.query("github_issues")
			.withIndex("by_repositoryId_and_number", (q) =>
				q.eq("repositoryId", repositoryId).eq("number", args.number),
			)
			.first();

		if (Option.isNone(issueOpt)) return null;
		const issue = issueOpt.value;

		// Resolve author
		const author = yield* resolveUser(issue.authorUserId);

		// Get comments
		const rawComments = yield* ctx.db
			.query("github_issue_comments")
			.withIndex("by_repositoryId_and_issueNumber", (q) =>
				q.eq("repositoryId", repositoryId).eq("issueNumber", args.number),
			)
			.collect();

		// Resolve comment authors
		const comments = yield* Effect.all(
			rawComments.map((c) =>
				Effect.gen(function* () {
					const commentAuthor = yield* resolveUser(c.authorUserId);
					return {
						githubCommentId: c.githubCommentId,
						authorLogin: commentAuthor.login,
						authorAvatarUrl: commentAuthor.avatarUrl,
						body: c.body,
						createdAt: c.createdAt,
						updatedAt: c.updatedAt,
					};
				}),
			),
			{ concurrency: "unbounded" },
		);

		return {
			number: issue.number,
			state: issue.state,
			title: issue.title,
			body: issue.body,
			authorLogin: author.login,
			authorAvatarUrl: author.avatarUrl,
			labelNames: [...issue.labelNames],
			commentCount: issue.commentCount,
			closedAt: issue.closedAt,
			githubUpdatedAt: issue.githubUpdatedAt,
			comments,
		};
	}),
);

getPullRequestDetailDef.implement((args) =>
	Effect.gen(function* () {
		const repositoryId = yield* findRepo(args.ownerLogin, args.name);
		if (repositoryId === null) return null;

		const ctx = yield* ConfectQueryCtx;

		// Get the pull request
		const prOpt = yield* ctx.db
			.query("github_pull_requests")
			.withIndex("by_repositoryId_and_number", (q) =>
				q.eq("repositoryId", repositoryId).eq("number", args.number),
			)
			.first();

		if (Option.isNone(prOpt)) return null;
		const pr = prOpt.value;

		// Resolve author
		const author = yield* resolveUser(pr.authorUserId);

		// Get comments (issue comments also cover PR comments in GitHub API)
		const rawComments = yield* ctx.db
			.query("github_issue_comments")
			.withIndex("by_repositoryId_and_issueNumber", (q) =>
				q.eq("repositoryId", repositoryId).eq("issueNumber", args.number),
			)
			.collect();

		const comments = yield* Effect.all(
			rawComments.map((c) =>
				Effect.gen(function* () {
					const commentAuthor = yield* resolveUser(c.authorUserId);
					return {
						githubCommentId: c.githubCommentId,
						authorLogin: commentAuthor.login,
						authorAvatarUrl: commentAuthor.avatarUrl,
						body: c.body,
						createdAt: c.createdAt,
						updatedAt: c.updatedAt,
					};
				}),
			),
			{ concurrency: "unbounded" },
		);

		// Get reviews
		const rawReviews = yield* ctx.db
			.query("github_pull_request_reviews")
			.withIndex("by_repositoryId_and_pullRequestNumber", (q) =>
				q.eq("repositoryId", repositoryId).eq("pullRequestNumber", args.number),
			)
			.collect();

		const reviews = yield* Effect.all(
			rawReviews.map((r) =>
				Effect.gen(function* () {
					const reviewAuthor = yield* resolveUser(r.authorUserId);
					return {
						githubReviewId: r.githubReviewId,
						authorLogin: reviewAuthor.login,
						authorAvatarUrl: reviewAuthor.avatarUrl,
						state: r.state,
						submittedAt: r.submittedAt,
					};
				}),
			),
			{ concurrency: "unbounded" },
		);

		// Get check runs for this PR's head SHA
		const checkRuns = yield* ctx.db
			.query("github_check_runs")
			.withIndex("by_repositoryId_and_headSha", (q) =>
				q.eq("repositoryId", repositoryId).eq("headSha", pr.headSha),
			)
			.collect();

		return {
			number: pr.number,
			state: pr.state,
			draft: pr.draft,
			title: pr.title,
			body: pr.body,
			authorLogin: author.login,
			authorAvatarUrl: author.avatarUrl,
			headRefName: pr.headRefName,
			baseRefName: pr.baseRefName,
			headSha: pr.headSha,
			mergeableState: pr.mergeableState,
			mergedAt: pr.mergedAt,
			closedAt: pr.closedAt,
			githubUpdatedAt: pr.githubUpdatedAt,
			comments,
			reviews,
			checkRuns: checkRuns.map((cr) => ({
				name: cr.name,
				status: cr.status,
				conclusion: cr.conclusion,
				startedAt: cr.startedAt,
				completedAt: cr.completedAt,
			})),
		};
	}),
);

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

const projectionQueriesModule = makeRpcModule(
	{
		listRepos: listReposDef,
		getRepoOverview: getRepoOverviewDef,
		listPullRequests: listPullRequestsDef,
		listIssues: listIssuesDef,
		listActivity: listActivityDef,
		getIssueDetail: getIssueDetailDef,
		getPullRequestDetail: getPullRequestDetailDef,
	},
	{ middlewares: DatabaseRpcTelemetryLayer },
);

export const {
	listRepos,
	getRepoOverview,
	listPullRequests,
	listIssues,
	listActivity,
	getIssueDetail,
	getPullRequestDetail,
} = projectionQueriesModule.handlers;
export { projectionQueriesModule };
export type ProjectionQueriesModule = typeof projectionQueriesModule;
