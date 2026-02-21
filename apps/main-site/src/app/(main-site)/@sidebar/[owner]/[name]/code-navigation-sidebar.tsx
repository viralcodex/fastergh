import { Suspense } from "react";
import { RepoListShell } from "../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../_components/skeletons";
import { FileTreeClient } from "./code/file-tree-client";

export async function CodeNavigationSidebar(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await props.params;

	return (
		<RepoListShell paramsPromise={props.params} activeTab="code">
			<Suspense fallback={<ListSkeleton />}>
				<FileTreeClient owner={owner} name={name} />
			</Suspense>
		</RepoListShell>
	);
}
