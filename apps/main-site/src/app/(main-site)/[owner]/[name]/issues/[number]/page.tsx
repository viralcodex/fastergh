import { MainSiteShell } from "../../../../_components/main-site-shell";
import {
	IssueDetail,
	IssuesSidebarWithActive,
} from "../../../../_components/route-shell-content";

export default function IssueDetailPage({
	params,
}: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const activeIssueNumberPromise = params.then(({ number }) => {
		const parsed = Number.parseInt(number, 10);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const navContextPromise = params.then(({ owner, name }) => ({
		owner,
		name,
		activeTab: "issues",
	}));
	const repoParams = params.then(({ owner, name }) => ({ owner, name }));

	return (
		<MainSiteShell
			sidebar={
				<IssuesSidebarWithActive
					params={repoParams}
					activeIssueNumberPromise={activeIssueNumberPromise}
				/>
			}
			detail={<IssueDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
