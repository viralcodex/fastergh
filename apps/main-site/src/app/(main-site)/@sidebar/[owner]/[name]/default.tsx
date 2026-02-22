import { serverQueries } from "@/lib/server-queries";
import { PrListClient } from "../../../_components/pr-list-client";
import { RepoListShell } from "../../../_components/repo-list-shell";
import { SidebarRepoList } from "../../sidebar-repo-list";

export default function SidebarRepoDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activePullNumber?: number | null;
}) {
	return (
		<Content
			paramsPromise={props.params}
			activePullNumber={props.activePullNumber}
		/>
	);
}

async function Content({
	paramsPromise,
	activePullNumber,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activePullNumber?: number | null;
}) {
	const { owner, name } = await paramsPromise;
	const initialRepos = await serverQueries.listRepos.queryPromise({});

	if (!owner || !name || owner.length === 0 || name.length === 0) {
		return <SidebarRepoList initialRepos={initialRepos} />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="pulls">
			<PrListContent
				owner={owner}
				name={name}
				activePullNumber={activePullNumber ?? null}
			/>
		</RepoListShell>
	);
}

async function PrListContent({
	owner,
	name,
	activePullNumber,
}: {
	owner: string;
	name: string;
	activePullNumber: number | null;
}) {
	const initialPrs = await serverQueries.listPullRequests
		.queryPromise({
			ownerLogin: owner,
			name,
			state: "open",
		})
		.catch(() => []);

	return (
		<PrListClient
			owner={owner}
			name={name}
			initialData={initialPrs}
			activePullNumber={activePullNumber}
		/>
	);
}
