import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../../_components/skeletons";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";
import { SidebarRepoList } from "../../../sidebar-repo-list";

export default function ActionsListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activeRunNumberPromise?: Promise<number | null>;
}) {
	return (
		<ActionsListEntry
			paramsPromise={props.params}
			activeRunNumberPromise={props.activeRunNumberPromise}
		/>
	);
}

/** Entry — resolves params and routes to cached shell or fallback. */
async function ActionsListEntry({
	paramsPromise,
	activeRunNumberPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activeRunNumberPromise?: Promise<number | null>;
}) {
	const { owner, name } = await paramsPromise;
	const activeRunNumber = activeRunNumberPromise
		? await activeRunNumberPromise
		: null;

	if (!owner || !name) {
		return <FallbackRepoList />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="actions">
			<Suspense fallback={<ListSkeleton />}>
				<WorkflowRunListContent
					owner={owner}
					name={name}
					activeRunNumber={activeRunNumber ?? null}
				/>
			</Suspense>
		</RepoListShell>
	);
}

async function FallbackRepoList() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}

async function WorkflowRunListContent({
	owner,
	name,
	activeRunNumber,
}: {
	owner: string;
	name: string;
	activeRunNumber: number | null;
}) {
	const initialData = await serverQueries.listWorkflowRuns
		.queryPromise({ ownerLogin: owner, name })
		.catch(() => []);

	return (
		<WorkflowRunListClient
			owner={owner}
			name={name}
			initialData={initialData}
			activeRunNumber={activeRunNumber}
		/>
	);
}
