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
	return (
		<MainSiteShell
			sidebar={<ActionsSidebar params={params} />}
			detail={<ActionsDetail params={params} />}
		/>
	);
}
