import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "../_generated/api";

/**
 * Shared WorkflowManager instance backed by the `workflow` Convex component.
 *
 * Global parallelism is set to 50 — Convex can handle the concurrency and
 * GitHub rate limits are per-installation (5,000 req/hr), not global.
 * Per-installation fairness is enforced at the application layer in
 * startBootstrap / onBootstrapComplete.
 *
 * Retry policy: actions are retried with exponential backoff by default.
 * The longer initial backoff (30s) and 8 max attempts give a window of
 * ~2+ minutes which covers most GitHub primary rate limit resets (~60s).
 *
 * Backoff progression: 30s → 60s → 120s → 240s → ...
 */
export const workflow = new WorkflowManager(components.workflow, {
	workpoolOptions: {
		maxParallelism: 50,
		defaultRetryBehavior: {
			maxAttempts: 8,
			initialBackoffMs: 30_000,
			base: 2,
		},
		retryActionsByDefault: true,
	},
});
