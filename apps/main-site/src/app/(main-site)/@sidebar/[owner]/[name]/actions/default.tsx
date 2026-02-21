import { connection } from "next/server";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { WorkflowRunListClient } from "../../../../_components/workflow-run-list-client";
import { SidebarClient, SidebarSkeleton } from "../../../sidebar-client";
import { SidebarRepoList } from "../../../sidebar-repo-list";

export default function ActionsListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<Suspense fallback={<SidebarSkeleton />}>
			<Content paramsPromise={props.params} />
		</Suspense>
	);
}

async function Content({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	await connection();
	const { owner, name } = await paramsPromise;
	const initialRepos = await serverQueries.listRepos.queryPromise({});

	if (!owner || !name) {
		return (
			<SidebarClient initialRepos={initialRepos}>
				<SidebarRepoList initialRepos={initialRepos} />
			</SidebarClient>
		);
	}

	return (
		<SidebarClient initialRepos={initialRepos}>
			<RepoListShell paramsPromise={paramsPromise} activeTab="actions">
				<WorkflowRunListContent owner={owner} name={name} />
			</RepoListShell>
		</SidebarClient>
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
