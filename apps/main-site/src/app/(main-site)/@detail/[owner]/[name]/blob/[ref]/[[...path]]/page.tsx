import { FileViewer } from "../../../code/file-viewer";

export default async function BlobDetailPage({
	params,
}: {
	params: Promise<{
		owner: string;
		name: string;
		ref: string;
		path?: string[];
	}>;
}) {
	const { owner, name, ref, path } = await params;
	const filePath = path === undefined ? null : path.join("/");

	return <FileViewer owner={owner} name={name} path={filePath} refName={ref} />;
}
