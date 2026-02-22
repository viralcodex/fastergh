import { serverQueries } from "@/lib/server-queries";
import { SidebarRepoList } from "../sidebar-repo-list";

/**
 * Sidebar for the org overview page (/:owner).
 * Shows the repo list filtered to that org (handled client-side by RepoNavSelector).
 */
export default function OrgSidebarDefault() {
	return <Content />;
}

async function Content() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}
