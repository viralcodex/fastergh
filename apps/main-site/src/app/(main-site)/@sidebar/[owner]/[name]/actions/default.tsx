import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../../_components/skeletons";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";

/**
 * Sidebar for the actions/workflow runs list.
 *
 * Synchronous so the outer sidebar Suspense boundary is never triggered.
 * The cached `RepoListShell` renders the tab bar instantly, and all async
 * work happens inside the inner `<Suspense>`.
 *
 * `activeRunIdPromise` lets detail pages (e.g. actions/runs/[runId]) pass their
 * params through without awaiting — run number extraction happens inside Suspense.
 */
export default function ActionsListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activeRunNumber?: number | null;
	activeRunIdPromise?: Promise<{ runId: string }>;
}) {
	return (
		<RepoListShell paramsPromise={props.params} activeTab="actions">
			<Suspense fallback={<ListSkeleton />}>
				<WorkflowRunListContent
					paramsPromise={props.params}
					activeRunNumber={props.activeRunNumber ?? null}
					activeRunIdPromise={props.activeRunIdPromise}
				/>
			</Suspense>
		</RepoListShell>
	);
}

async function WorkflowRunListContent({
	paramsPromise,
	activeRunNumber,
	activeRunIdPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activeRunNumber: number | null;
	activeRunIdPromise?: Promise<{ runId: string }>;
}) {
	const { owner, name } = await paramsPromise;

	let resolvedActive = activeRunNumber;
	if (activeRunIdPromise) {
		const { runId } = await activeRunIdPromise;
		const parsed = Number.parseInt(runId, 10);
		resolvedActive = Number.isNaN(parsed) ? null : parsed;
	}

	const initialData = await serverQueries.listWorkflowRuns
		.queryPromise({ ownerLogin: owner, name })
		.catch(() => []);

	return (
		<WorkflowRunListClient
			owner={owner}
			name={name}
			initialData={initialData}
			activeRunNumber={resolvedActive}
		/>
	);
}
