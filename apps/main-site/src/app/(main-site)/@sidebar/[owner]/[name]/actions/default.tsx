import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";
import { SidebarRepoList } from "../../../sidebar-repo-list";

export default function ActionsListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return <Content paramsPromise={props.params} />;
}

async function Content({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await paramsPromise;
	const initialRepos = await serverQueries.listRepos.queryPromise({});

	if (!owner || !name) {
		return <SidebarRepoList initialRepos={initialRepos} />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="actions">
			<WorkflowRunListContent owner={owner} name={name} />
		</RepoListShell>
	);
}

async function WorkflowRunListContent({
	owner,
	name,
}: {
	owner: string;
	name: string;
}) {
	const initialData = await serverQueries.listWorkflowRuns
		.queryPromise({ ownerLogin: owner, name })
		.catch(() => []);

	return (
		<WorkflowRunListClient
			owner={owner}
			name={name}
			initialData={initialData}
		/>
	);
}
