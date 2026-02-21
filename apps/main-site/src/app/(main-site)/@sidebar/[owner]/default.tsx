import { connection } from "next/server";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListSkeleton, SidebarRepoList } from "../sidebar-repo-list";

/**
 * Sidebar for the org overview page (/:owner).
 * Shows the repo list filtered to that org (handled client-side by RepoNavSelector).
 */
export default function OrgSidebarDefault() {
	return (
		<Suspense fallback={<RepoListSkeleton />}>
			<Content />
		</Suspense>
	);
}

async function Content() {
	await connection();
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}
