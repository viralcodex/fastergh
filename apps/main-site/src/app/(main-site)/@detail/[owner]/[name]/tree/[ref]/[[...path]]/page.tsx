import { FileViewer } from "../../../code/file-viewer";

export default async function TreeDetailPage({
	params,
}: {
	params: Promise<{ owner: string; name: string; ref: string }>;
}) {
	const { owner, name, ref } = await params;

	return <FileViewer owner={owner} name={name} path={null} refName={ref} />;
}
