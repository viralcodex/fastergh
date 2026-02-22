import { MainSiteShell } from "../../../../_components/main-site-shell";
import {
	PullDetail,
	PullsSidebarWithActive,
} from "../../../../_components/route-shell-content";

export default function PrDetailPage({
	params,
}: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const activePullNumberPromise = params.then(({ number }) => {
		const parsed = Number.parseInt(number, 10);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const repoParams = params.then(({ owner, name }) => ({ owner, name }));

	return (
		<MainSiteShell
			sidebar={
				<PullsSidebarWithActive
					params={repoParams}
					activePullNumberPromise={activePullNumberPromise}
				/>
			}
			detail={<PullDetail params={params} />}
		/>
	);
}
