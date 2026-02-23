import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";
import { SidebarRepoList } from "../../../sidebar-repo-list";

export default function ActionsListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activeRunNumberPromise?: Promise<number | null>;
}) {
	return (
		<Content
			paramsPromise={props.params}
			activeRunNumberPromise={props.activeRunNumberPromise}
		/>
	);
}

async function Content({
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
	const initialRepos = await serverQueries.listRepos.queryPromise({});

	if (!owner || !name) {
		return <SidebarRepoList initialRepos={initialRepos} />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="actions">
			<WorkflowRunListContent
				owner={owner}
				name={name}
				activeRunNumber={activeRunNumber ?? null}
			/>
		</RepoListShell>
	);
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
