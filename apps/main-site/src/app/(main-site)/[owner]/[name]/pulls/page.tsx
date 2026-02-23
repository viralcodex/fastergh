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
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
		activeTab: "pulls",
	}));

	return (
		<MainSiteShell
			sidebar={<PullsSidebar params={params} />}
			detail={<PullsDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
