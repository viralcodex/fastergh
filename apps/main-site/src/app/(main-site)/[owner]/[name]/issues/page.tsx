import { MainSiteShell } from "../../../_components/main-site-shell";
import {
	IssuesDetail,
	IssuesSidebar,
} from "../../../_components/route-shell-content";

export default function IssuesPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<MainSiteShell
			sidebar={<IssuesSidebar params={params} />}
			detail={<IssuesDetail params={params} />}
		/>
	);
}
