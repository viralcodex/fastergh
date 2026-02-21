import {
	type MiddlewareImplementation,
	type MiddlewareOptions,
	middleware,
	RpcMiddleware,
} from "@packages/confect/rpc";
import { Context, Data, Effect, Either, Schema } from "effect";
import { internal } from "../_generated/api";

const RepoPermissionLevelSchema = Schema.Literal(
	"pull",
	"triage",
	"push",
	"maintain",
	"admin",
);

type RepoPermissionLevel = Schema.Schema.Type<typeof RepoPermissionLevelSchema>;

const RepoByIdPayloadSchema = Schema.Struct({
	repositoryId: Schema.Number,
});

const RepoByNamePayloadSchema = Schema.Struct({
	ownerLogin: Schema.String,
	name: Schema.String,
});

const RepoInfoByNameSchema = Schema.Struct({
	found: Schema.Boolean,
	repositoryId: Schema.optional(Schema.Number),
	installationId: Schema.optional(Schema.Number),
	isPrivate: Schema.optional(Schema.Boolean),
});

const RepoInfoByIdSchema = Schema.Struct({
	found: Schema.Boolean,
	ownerLogin: Schema.optional(Schema.String),
	name: Schema.optional(Schema.String),
	installationId: Schema.optional(Schema.Number),
	isPrivate: Schema.optional(Schema.Boolean),
});

const decodeRepoByIdPayload = Schema.decodeUnknownEither(RepoByIdPayloadSchema);
const decodeRepoByNamePayload = Schema.decodeUnknownEither(
	RepoByNamePayloadSchema,
);
const decodeRepoInfoByName = Schema.decodeUnknownEither(RepoInfoByNameSchema);
const decodeRepoInfoById = Schema.decodeUnknownEither(RepoInfoByIdSchema);
const decodeBoolean = Schema.decodeUnknownEither(Schema.Boolean);

type RepoPermissionContextValue = {
	repositoryId: number;
	ownerLogin: string;
	name: string;
	installationId: number;
	isPrivate: boolean;
	required: RepoPermissionLevel;
	userId: string | null;
};

export class RepoPermissionContext extends Context.Tag(
	"@quickhub/RepoPermissionContext",
)<RepoPermissionContext, RepoPermissionContextValue>() {}

type AuthenticatedUserValue = {
	userId: string;
};

export class AuthenticatedUser extends Context.Tag(
	"@quickhub/AuthenticatedUser",
)<AuthenticatedUser, AuthenticatedUserValue>() {}

class RepoAccessViolation extends Data.TaggedError("RepoAccessViolation")<{
	reason:
		| "invalid_payload"
		| "repo_not_found"
		| "not_authenticated"
		| "insufficient_permission"
		| "invalid_repo_info";
	message: string;
	repositoryId: number | null;
	ownerLogin: string | null;
	name: string | null;
	required: RepoPermissionLevel;
	userId: string | null;
}> {}

const parseUserId = (
	identity: {
		subject?: string;
	} | null,
): string | null => {
	if (identity === null) return null;
	if (identity.subject === undefined) return null;
	if (identity.subject.length === 0) return null;
	return identity.subject;
};

const resolveIdentityUserId = (options: MiddlewareOptions) =>
	Effect.gen(function* () {
		const identity = yield* Effect.promise(() =>
			options.ctx.auth.getUserIdentity(),
		).pipe(Effect.orDie);
		return parseUserId(identity);
	});

const ensureRepoPermission = (
	options: MiddlewareOptions,
	repositoryId: number,
	isPrivate: boolean,
	required: RepoPermissionLevel,
	userId: string | null,
	requireAuthenticated: boolean,
	ownerLogin: string | null,
	name: string | null,
): Effect.Effect<boolean> =>
	Effect.gen(function* () {
		const hasPermissionRaw = yield* Effect.promise(() =>
			options.ctx.runQuery(internal.rpc.codeBrowse.hasRepoPermission, {
				repositoryId,
				isPrivate,
				userId,
				required,
				requireAuthenticated,
			}),
		).pipe(Effect.orDie);

		const hasPermission = decodeBoolean(hasPermissionRaw);
		if (Either.isLeft(hasPermission) || !hasPermission.right) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason:
						userId === null ? "not_authenticated" : "insufficient_permission",
					message:
						userId === null
							? "Authentication is required"
							: `Missing required repository permission: ${required}`,
					repositoryId,
					ownerLogin,
					name,
					required,
					userId,
				}),
			);
		}

		return true;
	});

const authorizeRepoById = (
	options: MiddlewareOptions,
	required: RepoPermissionLevel,
	requireAuthenticated: boolean,
): Effect.Effect<RepoPermissionContextValue> =>
	Effect.gen(function* () {
		const decodedPayload = decodeRepoByIdPayload(options.payload);
		if (Either.isLeft(decodedPayload)) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "invalid_payload",
					message: "Expected payload to include repositoryId",
					repositoryId: null,
					ownerLogin: null,
					name: null,
					required,
					userId: null,
				}),
			);
		}

		const repositoryId = decodedPayload.right.repositoryId;
		const repoInfoRaw = yield* Effect.promise(() =>
			options.ctx.runQuery(internal.rpc.codeBrowse.getRepoInfoById, {
				repositoryId,
			}),
		).pipe(Effect.orDie);

		const repoInfo = decodeRepoInfoById(repoInfoRaw);
		if (Either.isLeft(repoInfo) || !repoInfo.right.found) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "repo_not_found",
					message: "Repository not found",
					repositoryId,
					ownerLogin: null,
					name: null,
					required,
					userId: null,
				}),
			);
		}

		const ownerLogin = repoInfo.right.ownerLogin;
		const name = repoInfo.right.name;
		if (ownerLogin === undefined || name === undefined) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "invalid_repo_info",
					message: "Repository metadata is incomplete",
					repositoryId,
					ownerLogin: null,
					name: null,
					required,
					userId: null,
				}),
			);
		}

		const userId = yield* resolveIdentityUserId(options);
		if (requireAuthenticated && userId === null) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "not_authenticated",
					message: "Authentication is required",
					repositoryId,
					ownerLogin,
					name,
					required,
					userId: null,
				}),
			);
		}

		const isPrivate = repoInfo.right.isPrivate ?? true;
		yield* ensureRepoPermission(
			options,
			repositoryId,
			isPrivate,
			required,
			userId,
			requireAuthenticated,
			ownerLogin,
			name,
		);

		return {
			repositoryId,
			ownerLogin,
			name,
			installationId: repoInfo.right.installationId ?? 0,
			isPrivate,
			required,
			userId,
		};
	});

const authorizeRepoByName = (
	options: MiddlewareOptions,
	required: RepoPermissionLevel,
	requireAuthenticated: boolean,
): Effect.Effect<RepoPermissionContextValue> =>
	Effect.gen(function* () {
		const decodedPayload = decodeRepoByNamePayload(options.payload);
		if (Either.isLeft(decodedPayload)) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "invalid_payload",
					message: "Expected payload to include ownerLogin and name",
					repositoryId: null,
					ownerLogin: null,
					name: null,
					required,
					userId: null,
				}),
			);
		}

		const ownerLogin = decodedPayload.right.ownerLogin;
		const name = decodedPayload.right.name;

		const repoInfoRaw = yield* Effect.promise(() =>
			options.ctx.runQuery(internal.rpc.codeBrowse.getRepoInfo, {
				ownerLogin,
				name,
			}),
		).pipe(Effect.orDie);

		const repoInfo = decodeRepoInfoByName(repoInfoRaw);
		if (Either.isLeft(repoInfo) || !repoInfo.right.found) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "repo_not_found",
					message: "Repository not found",
					repositoryId: null,
					ownerLogin,
					name,
					required,
					userId: null,
				}),
			);
		}

		const repositoryId = repoInfo.right.repositoryId;
		if (repositoryId === undefined) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "invalid_repo_info",
					message: "Repository metadata is incomplete",
					repositoryId: null,
					ownerLogin,
					name,
					required,
					userId: null,
				}),
			);
		}

		const userId = yield* resolveIdentityUserId(options);
		if (requireAuthenticated && userId === null) {
			return yield* Effect.die(
				new RepoAccessViolation({
					reason: "not_authenticated",
					message: "Authentication is required",
					repositoryId,
					ownerLogin,
					name,
					required,
					userId: null,
				}),
			);
		}

		const isPrivate = repoInfo.right.isPrivate ?? true;
		yield* ensureRepoPermission(
			options,
			repositoryId,
			isPrivate,
			required,
			userId,
			requireAuthenticated,
			ownerLogin,
			name,
		);

		return {
			repositoryId,
			ownerLogin,
			name,
			installationId: repoInfo.right.installationId ?? 0,
			isPrivate,
			required,
			userId,
		};
	});

export class RequireAuthenticatedMiddleware extends RpcMiddleware.Tag<RequireAuthenticatedMiddleware>()(
	"RequireAuthenticatedMiddleware",
	{
		provides: AuthenticatedUser,
	},
) {}

export class RepoPullByIdMiddleware extends RpcMiddleware.Tag<RepoPullByIdMiddleware>()(
	"RepoPullByIdMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoTriageByIdMiddleware extends RpcMiddleware.Tag<RepoTriageByIdMiddleware>()(
	"RepoTriageByIdMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoPushByIdMiddleware extends RpcMiddleware.Tag<RepoPushByIdMiddleware>()(
	"RepoPushByIdMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoMaintainByIdMiddleware extends RpcMiddleware.Tag<RepoMaintainByIdMiddleware>()(
	"RepoMaintainByIdMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoAdminByIdMiddleware extends RpcMiddleware.Tag<RepoAdminByIdMiddleware>()(
	"RepoAdminByIdMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoPullByNameMiddleware extends RpcMiddleware.Tag<RepoPullByNameMiddleware>()(
	"RepoPullByNameMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoTriageByNameMiddleware extends RpcMiddleware.Tag<RepoTriageByNameMiddleware>()(
	"RepoTriageByNameMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoPushByNameMiddleware extends RpcMiddleware.Tag<RepoPushByNameMiddleware>()(
	"RepoPushByNameMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoMaintainByNameMiddleware extends RpcMiddleware.Tag<RepoMaintainByNameMiddleware>()(
	"RepoMaintainByNameMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export class RepoAdminByNameMiddleware extends RpcMiddleware.Tag<RepoAdminByNameMiddleware>()(
	"RepoAdminByNameMiddleware",
	{
		provides: RepoPermissionContext,
	},
) {}

export const DatabaseSecurityMiddlewareImplementations: ReadonlyArray<MiddlewareImplementation> =
	[
		middleware(RequireAuthenticatedMiddleware, (options: MiddlewareOptions) =>
			Effect.gen(function* () {
				const userId = yield* resolveIdentityUserId(options);
				if (userId === null) {
					return yield* Effect.die(
						new RepoAccessViolation({
							reason: "not_authenticated",
							message: "Authentication is required",
							repositoryId: null,
							ownerLogin: null,
							name: null,
							required: "pull",
							userId: null,
						}),
					);
				}
				return { userId };
			}),
		),
		middleware(RepoPullByIdMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoById(options, "pull", false),
		),
		middleware(RepoTriageByIdMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoById(options, "triage", false),
		),
		middleware(RepoPushByIdMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoById(options, "push", false),
		),
		middleware(RepoMaintainByIdMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoById(options, "maintain", false),
		),
		middleware(RepoAdminByIdMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoById(options, "admin", false),
		),
		middleware(RepoPullByNameMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoByName(options, "pull", false),
		),
		middleware(RepoTriageByNameMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoByName(options, "triage", false),
		),
		middleware(RepoPushByNameMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoByName(options, "push", false),
		),
		middleware(RepoMaintainByNameMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoByName(options, "maintain", false),
		),
		middleware(RepoAdminByNameMiddleware, (options: MiddlewareOptions) =>
			authorizeRepoByName(options, "admin", false),
		),
	];
