import { connection } from "next/server";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListSkeleton, SidebarRepoList } from "./sidebar-repo-list";

export default function SidebarDefault() {
	return (
		<Suspense fallback={<RepoListSkeleton />}>
			<SidebarRepoListContent />
		</Suspense>
	);
}

async function SidebarRepoListContent() {
	await connection();
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}
