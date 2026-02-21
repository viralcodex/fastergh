import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientError from "@effect/platform/HttpClientError";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import { Context, Data, Effect, Layer, Schema as S } from "effect";
import {
	type GitHubClient,
	make as makeGeneratedClient,
} from "./generated_github_client";
import { getInstallationToken } from "./githubApp";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class GitHubApiError extends Data.TaggedError("GitHubApiError")<{
	readonly status: number;
	readonly message: string;
	readonly url: string;
}> {}

/**
 * Thrown when GitHub returns a rate limit response (429 or 403 with
 * rate-limit headers). Includes the `retryAfterMs` hint from the
 * `Retry-After` / `X-RateLimit-Reset` headers so callers can back off.
 */
export class GitHubRateLimitError extends Data.TaggedError(
	"GitHubRateLimitError",
)<{
	readonly status: number;
	readonly message: string;
	readonly url: string;
	readonly retryAfterMs: number;
}> {}

// ---------------------------------------------------------------------------
// Rate-limit detection helpers
// ---------------------------------------------------------------------------

const parseRetryAfterMs = (headers: Headers): number => {
	const retryAfter = headers.get("Retry-After");
	if (retryAfter) {
		const secs = Number(retryAfter);
		if (!Number.isNaN(secs) && secs > 0) return secs * 1_000;
	}

	const resetEpoch = headers.get("X-RateLimit-Reset");
	if (resetEpoch) {
		const resetMs = Number(resetEpoch) * 1_000;
		const delta = resetMs - Date.now();
		if (delta > 0) return delta;
	}

	return 60_000;
};

const isRateLimitResponse = (status: number, headers: Headers): boolean => {
	if (status === 429) return true;
	if (status === 403) {
		const remaining = headers.get("X-RateLimit-Remaining");
		if (remaining === "0") return true;
	}
	return false;
};

// ---------------------------------------------------------------------------
// GitHub API Client
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.github.com";

type IGitHubApiClient = Readonly<{
	/**
	 * The fully typed GitHub API client generated from the OpenAPI spec.
	 * Each method returns a typed `Effect` with proper request/response types.
	 *
	 * Usage:
	 * ```ts
	 * const gh = yield* GitHubApiClient;
	 * const pr = yield* gh.client.pullsGet(owner, repo, String(number));
	 * ```
	 */
	client: GitHubClient;

	/**
	 * The underlying `@effect/platform` HttpClient with auth headers baked in.
	 * Useful for GraphQL or other endpoints not covered by the generated client.
	 */
	httpClient: HttpClient.HttpClient;

	// -----------------------------------------------------------------
	// Non-JSON helpers — endpoints that return raw text or empty bodies
	// -----------------------------------------------------------------

	/**
	 * Fetch a pull request as a raw unified diff.
	 * Returns `null` when the PR is not found (404).
	 */
	pullsGetDiff: (
		owner: string,
		repo: string,
		pullNumber: string,
	) => Effect.Effect<string | null, HttpClientError.HttpClientError>;

	/**
	 * Download the logs for a specific workflow job.
	 * Returns the raw log text, or `null` on 404.
	 */
	actionsDownloadJobLogs: (
		owner: string,
		repo: string,
		jobId: string,
	) => Effect.Effect<string | null, HttpClientError.HttpClientError>;

	/**
	 * Re-run an entire workflow run. Resolves with `true` on 201/202/204.
	 */
	actionsRerunWorkflow: (
		owner: string,
		repo: string,
		runId: string,
	) => Effect.Effect<
		{ accepted: boolean },
		GitHubApiError | HttpClientError.HttpClientError
	>;

	/**
	 * Re-run only the failed jobs of a workflow run.
	 */
	actionsRerunFailedJobs: (
		owner: string,
		repo: string,
		runId: string,
	) => Effect.Effect<
		{ accepted: boolean },
		GitHubApiError | HttpClientError.HttpClientError
	>;

	/**
	 * Cancel a workflow run.
	 */
	actionsCancelWorkflowRun: (
		owner: string,
		repo: string,
		runId: string,
	) => Effect.Effect<
		{ accepted: boolean },
		GitHubApiError | HttpClientError.HttpClientError
	>;

	/**
	 * Dispatch a workflow (create a `workflow_dispatch` event).
	 */
	actionsDispatchWorkflow: (
		owner: string,
		repo: string,
		workflowId: string,
		ref: string,
	) => Effect.Effect<
		{ accepted: boolean },
		GitHubApiError | HttpClientError.HttpClientError
	>;
}>;

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

/**
 * Build an `@effect/platform` HttpClient backed by the global `fetch`,
 * with GitHub auth headers, base URL, and rate-limit detection baked in.
 *
 * We use `HttpClient.mapRequest` to rewrite relative paths to absolute
 * URLs BEFORE the platform's internal `UrlParams.makeUrl` tries to parse
 * the request URL. Without this, `new URL("/repos/...", undefined)` throws
 * in runtimes that lack `globalThis.location` (like Convex).
 */
const makeAuthedHttpClient = (token: string): HttpClient.HttpClient =>
	HttpClient.mapRequest(
		HttpClient.make((request, url, signal, _fiber) =>
			Effect.gen(function* () {
				// Convert HttpClientRequest body to a BodyInit for native fetch.
				// bodyUnsafeJson produces a Uint8Array body (JSON.stringify → TextEncoder.encode).
				// Raw bodies may also appear from manual request construction.
				let body: string | undefined;
				if (
					request.body._tag === "Uint8Array" &&
					request.body.body !== undefined
				) {
					body = new TextDecoder().decode(request.body.body);
				} else if (
					request.body._tag === "Raw" &&
					request.body.body !== undefined
				) {
					body = String(request.body.body);
				}

				// Merge auth headers with any request-specific headers.
				// Effect Headers is a branded record — extract entries to merge cleanly.
				const requestHeaders = Object.fromEntries(
					Object.entries(request.headers),
				);
				const mergedHeaders: Record<string, string> = {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
					// bodyUnsafeJson sets the body as raw pre-serialized JSON but
					// doesn't add Content-Type since we bypass the platform layer.
					...(body !== undefined ? { "Content-Type": "application/json" } : {}),
					...requestHeaders,
				};

				const res = yield* Effect.tryPromise({
					try: () =>
						fetch(url.href, {
							method: request.method,
							headers: mergedHeaders,
							body,
							signal,
						}),
					catch: (cause) =>
						new HttpClientError.RequestError({
							request,
							reason: "Transport",
							description: String(cause),
						}),
				});

				// Detect rate limits at the transport layer.
				// We surface these as HttpClientError.ResponseError so the type
				// fits HttpClient's error channel. Callers can catchTag on it.
				if (isRateLimitResponse(res.status, res.headers)) {
					return yield* new HttpClientError.ResponseError({
						request,
						response: HttpClientResponse.fromWeb(request, res),
						reason: "StatusCode",
						description: `GitHub rate limit hit (${res.status}). Retry after ${Math.round(parseRetryAfterMs(res.headers) / 1_000)}s.`,
					});
				}

				return HttpClientResponse.fromWeb(request, res);
			}).pipe(Effect.withSpan("github_api.request")),
		),
		(request) => {
			// Prepend base URL to relative paths so the platform's URL parser
			// receives an absolute URL it can parse without a base.
			const url = request.url;
			if (typeof url === "string" && url.startsWith("/")) {
				return HttpClientRequest.setUrl(request, `${BASE_URL}${url}`);
			}
			return request;
		},
	);

// ---------------------------------------------------------------------------
// Non-JSON helper implementations
// ---------------------------------------------------------------------------

/**
 * Execute a request that returns raw text. Returns `null` on 404.
 * Fails with `GitHubApiError` on non-2xx responses.
 */
const executeTextRequest = (
	client: HttpClient.HttpClient,
	request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<string | null, HttpClientError.HttpClientError> =>
	Effect.gen(function* () {
		const response = yield* client.execute(request);
		if (response.status === 404) return null;
		if (response.status < 200 || response.status >= 300) {
			return yield* new HttpClientError.ResponseError({
				request,
				response,
				reason: "StatusCode",
				description: `GitHub API returned ${response.status}`,
			});
		}
		return yield* response.text;
	});

/**
 * Execute a POST that expects a 201/202/204 "accepted" response with no body.
 */
const executeAcceptedRequest = (
	client: HttpClient.HttpClient,
	request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<
	{ accepted: boolean },
	GitHubApiError | HttpClientError.HttpClientError
> =>
	Effect.gen(function* () {
		const response = yield* client.execute(request);
		if (
			response.status === 201 ||
			response.status === 202 ||
			response.status === 204
		) {
			return { accepted: true };
		}

		const errorBody = yield* Effect.orElseSucceed(response.text, () => "");
		let message = `GitHub returned ${response.status}`;
		try {
			const parsed = JSON.parse(errorBody);
			if (
				typeof parsed === "object" &&
				parsed !== null &&
				"message" in parsed &&
				typeof parsed.message === "string"
			) {
				message = parsed.message;
			}
		} catch {
			// use default message
		}

		return yield* new GitHubApiError({
			status: response.status,
			message,
			url: request.url,
		});
	});

const makeClient = (token: string): IGitHubApiClient => {
	const httpClient = makeAuthedHttpClient(token);
	const typedClient = makeGeneratedClient(httpClient);
	return {
		client: typedClient,
		httpClient,

		pullsGetDiff: (owner, repo, pullNumber) =>
			executeTextRequest(
				httpClient,
				HttpClientRequest.setHeader(
					HttpClientRequest.get(`/repos/${owner}/${repo}/pulls/${pullNumber}`),
					"accept",
					"application/vnd.github.diff",
				),
			),

		actionsDownloadJobLogs: (owner, repo, jobId) =>
			executeTextRequest(
				httpClient,
				HttpClientRequest.get(
					`/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
				),
			),

		actionsRerunWorkflow: (owner, repo, runId) =>
			executeAcceptedRequest(
				httpClient,
				HttpClientRequest.post(
					`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`,
				),
			),

		actionsRerunFailedJobs: (owner, repo, runId) =>
			executeAcceptedRequest(
				httpClient,
				HttpClientRequest.post(
					`/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`,
				),
			),

		actionsCancelWorkflowRun: (owner, repo, runId) =>
			executeAcceptedRequest(
				httpClient,
				HttpClientRequest.post(
					`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`,
				),
			),

		actionsDispatchWorkflow: (owner, repo, workflowId, ref) =>
			executeAcceptedRequest(
				httpClient,
				HttpClientRequest.post(
					`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
				).pipe(HttpClientRequest.bodyUnsafeJson({ ref })),
			),
	};
};

export class GitHubApiClient extends Context.Tag("@quickhub/GitHubApiClient")<
	GitHubApiClient,
	IGitHubApiClient
>() {
	/**
	 * Construct a client layer from an explicit OAuth token string.
	 */
	static fromToken = (token: string) => Layer.succeed(this, makeClient(token));

	/**
	 * Construct a client layer from a GitHub App installation ID.
	 */
	static fromInstallation = (installationId: number) =>
		Layer.effect(
			this,
			Effect.gen(function* () {
				const token = yield* getInstallationToken(installationId);
				return makeClient(token);
			}),
		);
}

// ---------------------------------------------------------------------------
// Lenient array decoding
// ---------------------------------------------------------------------------

/**
 * Decode a raw JSON array item-by-item through an Effect Schema.
 * Items that fail to parse are collected as `{ index, error, raw }` and
 * returned separately so callers can dead-letter them without crashing
 * the entire fetch.
 *
 * Usage in bootstrap steps:
 * ```ts
 * const { items, skipped } = decodeLenientArray(rawJsonArray, PullRequestSimple);
 * // items: PullRequestSimple[]
 * // skipped: { index, error, raw }[]
 * ```
 */
export const decodeLenientArray = <A, I>(
	rawArray: ReadonlyArray<unknown>,
	schema: S.Schema<A, I>,
): {
	items: Array<A>;
	skipped: Array<{ index: number; error: string; raw: string }>;
} => {
	const decode = S.decodeUnknownEither(schema);
	const items: Array<A> = [];
	const skipped: Array<{ index: number; error: string; raw: string }> = [];

	for (let i = 0; i < rawArray.length; i++) {
		const result = decode(rawArray[i]);
		if (result._tag === "Right") {
			items.push(result.right);
		} else {
			const errorMsg = `Schema parse error at index ${i}: ${result.left.message}`;
			let rawStr: string;
			try {
				rawStr = JSON.stringify(rawArray[i]);
			} catch {
				rawStr = String(rawArray[i]);
			}
			// Truncate raw to avoid huge payloads
			skipped.push({
				index: i,
				error: errorMsg,
				raw:
					rawStr.length > 2000
						? rawStr.slice(0, 2000) + "...(truncated)"
						: rawStr,
			});
		}
	}

	return { items, skipped };
};

/**
 * Fetch a JSON array endpoint and decode each item leniently.
 * Uses the raw httpClient to bypass the generated client's strict schema decoding.
 * Returns successfully parsed items + skipped items for dead-lettering.
 */
export const fetchArrayLenient = <A, I>(
	schema: S.Schema<A, I>,
	request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<
	{
		items: Array<A>;
		skipped: Array<{ index: number; error: string; raw: string }>;
	},
	HttpClientError.HttpClientError,
	GitHubApiClient
> =>
	Effect.gen(function* () {
		const gh = yield* GitHubApiClient;
		const response = yield* gh.httpClient.execute(request);
		if (response.status < 200 || response.status >= 300) {
			return yield* new HttpClientError.ResponseError({
				request,
				response,
				reason: "StatusCode",
				description: `GitHub API returned ${response.status}`,
			});
		}
		const body = yield* response.text;
		const rawArray = JSON.parse(body);
		if (!Array.isArray(rawArray)) {
			return { items: [], skipped: [] };
		}
		return decodeLenientArray(rawArray, schema);
	});

export type { GitHubClient, IGitHubApiClient };
