import { serverQueries } from "@/lib/server-queries";
import { SidebarRepoList } from "./sidebar-repo-list";

export default function SidebarDefault() {
	return <SidebarRepoListContent />;
}

async function SidebarRepoListContent() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}
