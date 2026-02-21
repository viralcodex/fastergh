import { FileViewerClient } from "./file-viewer-client";

export default async function CodeDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ owner: string; name: string }>;
	searchParams: Promise<{ path?: string }>;
}) {
	const { owner, name } = await params;
	const { path } = await searchParams;
	return <FileViewerClient owner={owner} name={name} path={path ?? null} />;
}
