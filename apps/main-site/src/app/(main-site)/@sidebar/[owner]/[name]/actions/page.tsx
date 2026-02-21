import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";

export default function ActionsListSlot(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<RepoListShell paramsPromise={props.params} activeTab="actions">
			<ActionsListContent paramsPromise={props.params} />
		</RepoListShell>
	);
}

async function ActionsListContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await paramsPromise;
	const initialData = await serverQueries.listWorkflowRuns
		.queryPromise({
			ownerLogin: owner,
			name,
		})
		.catch(() => []);

	return (
		<WorkflowRunListClient
			owner={owner}
			name={name}
			initialData={initialData}
		/>
	);
}
