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
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
		activeTab: "issues",
	}));

	return (
		<MainSiteShell
			sidebar={<IssuesSidebar params={params} />}
			detail={<IssuesDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
