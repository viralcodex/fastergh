import { MainSiteShell } from "../../../../../_components/main-site-shell";
import {
	TreeDetail,
	TreeSidebar,
} from "../../../../../_components/route-shell-content";

export default function TreePage({
	params,
}: {
	params: Promise<{
		owner: string;
		name: string;
		ref: string;
		path?: Array<string>;
	}>;
}) {
	const repoParams = params.then(({ owner, name }) => ({ owner, name }));
	const detailParams = params.then(({ owner, name, ref }) => ({
		owner,
		name,
		ref,
	}));

	return (
		<MainSiteShell
			sidebar={<TreeSidebar params={repoParams} />}
			detail={<TreeDetail params={detailParams} />}
		/>
	);
}
