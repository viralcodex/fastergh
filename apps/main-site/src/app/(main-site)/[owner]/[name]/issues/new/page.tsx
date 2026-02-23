import { MainSiteShell } from "../../../../_components/main-site-shell";
import {
	IssuesSidebar,
	NewIssueDetail,
} from "../../../../_components/route-shell-content";

export default function NewIssuePage({
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
			detail={<NewIssueDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
