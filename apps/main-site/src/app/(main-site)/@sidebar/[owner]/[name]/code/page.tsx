import { Suspense } from "react";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../../_components/skeletons";
import { FileTreeClient } from "./file-tree-client";

export default function CodeSidebarPage(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<RepoListShell paramsPromise={props.params} activeTab="code">
			<Suspense fallback={<ListSkeleton />}>
				<FileTreeClientWrapper paramsPromise={props.params} />
			</Suspense>
		</RepoListShell>
	);
}

async function FileTreeClientWrapper({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await paramsPromise;
	return <FileTreeClient owner={owner} name={name} />;
}
