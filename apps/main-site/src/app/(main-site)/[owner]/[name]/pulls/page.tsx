import { MainSiteShell } from "../../../_components/main-site-shell";
import {
	PullsDetail,
	PullsSidebar,
} from "../../../_components/route-shell-content";

export default function PullsPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<MainSiteShell
			sidebar={<PullsSidebar params={params} />}
			detail={<PullsDetail params={params} />}
		/>
	);
}
