import { FileViewer } from "../../../code/file-viewer";

export default function TreeDetailPage({
	params,
}: {
	params: Promise<{ owner: string; name: string; ref: string }>;
}) {
	return <TreeContent paramsPromise={params} />;
}

async function TreeContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string; ref: string }>;
}) {
	const { owner, name, ref } = await paramsPromise;

	return <FileViewer owner={owner} name={name} path={null} refName={ref} />;
}
