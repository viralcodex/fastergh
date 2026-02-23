import { FileViewer } from "../../../code/file-viewer";

export default function BlobDetailPage({
	params,
}: {
	params: Promise<{
		owner: string;
		name: string;
		ref: string;
		path?: string[];
	}>;
}) {
	return <BlobContent paramsPromise={params} />;
}

async function BlobContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		owner: string;
		name: string;
		ref: string;
		path?: string[];
	}>;
}) {
	const { owner, name, ref, path } = await paramsPromise;
	const filePath = path === undefined ? null : path.join("/");

	return <FileViewer owner={owner} name={name} path={filePath} refName={ref} />;
}
