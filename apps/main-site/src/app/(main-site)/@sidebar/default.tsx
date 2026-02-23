import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { ListSkeleton } from "../_components/skeletons";
import { SidebarRepoList } from "./sidebar-repo-list";

export default function SidebarDefault() {
	return (
		<Suspense fallback={<ListSkeleton />}>
			<SidebarRepoListContent />
		</Suspense>
	);
}

async function SidebarRepoListContent() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}
