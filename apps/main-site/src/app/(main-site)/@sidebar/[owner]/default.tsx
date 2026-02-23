import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { ListSkeleton } from "../../_components/skeletons";
import { SidebarRepoList } from "../sidebar-repo-list";

/**
 * Sidebar for the org overview page (/:owner).
 * Shows the repo list filtered to that org (handled client-side by RepoNavSelector).
 */
export default function OrgSidebarDefault(props: {
	params?: Promise<{ owner: string }>;
}) {
	return (
		<Suspense fallback={<ListSkeleton />}>
			<Content paramsPromise={props.params} />
		</Suspense>
	);
}

async function Content({
	paramsPromise,
}: {
	paramsPromise?: Promise<{ owner: string }>;
}) {
	const owner = paramsPromise ? (await paramsPromise).owner : null;
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} activeOwner={owner} />;
}
