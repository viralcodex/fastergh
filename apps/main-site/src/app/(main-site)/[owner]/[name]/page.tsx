import { MainSiteShell } from "../../_components/main-site-shell";
import {
	RepoOverviewDetail,
	RepoOverviewSidebar,
} from "../../_components/route-shell-content";

export default function RepoPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<MainSiteShell
			sidebar={<RepoOverviewSidebar params={params} />}
			detail={<RepoOverviewDetail params={params} />}
		/>
	);
}
