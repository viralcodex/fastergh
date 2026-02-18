import { createRpcFactory, makeRpcModule } from "@packages/confect/rpc";
import { Effect, Option, Schema } from "effect";
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
	},
	{ middlewares: DatabaseRpcTelemetryLayer },
);

export const {
	listRepos,
	getRepoOverview,
	listPullRequests,
	listIssues,
	listActivity,
} = projectionQueriesModule.handlers;
export { projectionQueriesModule };
export type ProjectionQueriesModule = typeof projectionQueriesModule;
