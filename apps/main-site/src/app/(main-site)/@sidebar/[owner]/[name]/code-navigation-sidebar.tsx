import { connection } from "next/server";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { RepoListShell } from "../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../_components/skeletons";
import { SidebarClient, SidebarSkeleton } from "../../sidebar-client";
import { FileTreeClient } from "./code/file-tree-client";

export function CodeNavigationSidebar(props: {
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

	return (
		<SidebarClient initialRepos={initialRepos}>
			<RepoListShell paramsPromise={paramsPromise} activeTab="code">
				<Suspense fallback={<ListSkeleton />}>
					<FileTreeClient owner={owner} name={name} />
				</Suspense>
			</RepoListShell>
		</SidebarClient>
	);
}
