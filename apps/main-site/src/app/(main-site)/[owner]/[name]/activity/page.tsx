import { MainSiteShell } from "../../../_components/main-site-shell";
import {
	RepoOverviewDetail,
	RepoOverviewSidebar,
} from "../../../_components/route-shell-content";

export default function ActivityPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
	}));

	return (
		<MainSiteShell
			sidebar={<RepoOverviewSidebar params={params} />}
			detail={<RepoOverviewDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
