import { MainSiteShell } from "../../../../../_components/main-site-shell";
import {
	ActionRunDetail,
	ActionsSidebarWithActive,
} from "../../../../../_components/route-shell-content";

export default function ActionRunDetailPage({
	params,
}: {
	params: Promise<{ owner: string; name: string; runId: string }>;
}) {
	const activeRunNumberPromise = params.then(({ runId }) => {
		const parsed = Number.parseInt(runId, 10);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const repoParams = params.then(({ owner, name }) => ({ owner, name }));

	return (
		<MainSiteShell
			sidebar={
				<ActionsSidebarWithActive
					params={repoParams}
					activeRunNumberPromise={activeRunNumberPromise}
				/>
			}
			detail={<ActionRunDetail params={params} />}
		/>
	);
}
