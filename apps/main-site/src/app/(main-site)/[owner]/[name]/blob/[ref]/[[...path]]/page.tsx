import { MainSiteShell } from "../../../../../_components/main-site-shell";
import {
	BlobDetail,
	BlobSidebar,
} from "../../../../../_components/route-shell-content";

export default function BlobPage({
	params,
}: {
	params: Promise<{
		owner: string;
		name: string;
		ref: string;
		path?: Array<string>;
	}>;
}) {
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
		activeTab: "code",
	}));
	const repoParams = params.then(({ owner, name }) => ({ owner, name }));

	return (
		<MainSiteShell
			sidebar={<BlobSidebar params={repoParams} />}
			detail={<BlobDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
