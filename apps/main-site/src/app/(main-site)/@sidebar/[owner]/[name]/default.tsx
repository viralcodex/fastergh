import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { PrListClient } from "../../../_components/pr-list-client";
import { RepoListShell } from "../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../_components/skeletons";
import { SidebarRepoList } from "../../sidebar-repo-list";

export default function SidebarRepoDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activePullNumber?: number | null;
}) {
	return (
		<SidebarRepoEntry
			paramsPromise={props.params}
			activePullNumber={props.activePullNumber}
		/>
	);
}

/** Entry — resolves params and routes to cached shell or fallback. */
async function SidebarRepoEntry({
	paramsPromise,
	activePullNumber,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activePullNumber?: number | null;
}) {
	const { owner, name } = await paramsPromise;

	if (!owner || !name || owner.length === 0 || name.length === 0) {
		return <FallbackRepoList />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="pulls">
			<Suspense fallback={<ListSkeleton />}>
				<PrListContent
					owner={owner}
					name={name}
					activePullNumber={activePullNumber ?? null}
				/>
			</Suspense>
		</RepoListShell>
	);
}

async function FallbackRepoList() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
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
