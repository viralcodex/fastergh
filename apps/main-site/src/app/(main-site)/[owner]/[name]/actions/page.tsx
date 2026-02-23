import { MainSiteShell } from "../../../_components/main-site-shell";
import {
	ActionsDetail,
	ActionsSidebar,
} from "../../../_components/route-shell-content";

export default function ActionsPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
		activeTab: "actions",
	}));

	return (
		<MainSiteShell
			sidebar={<ActionsSidebar params={params} />}
			detail={<ActionsDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
