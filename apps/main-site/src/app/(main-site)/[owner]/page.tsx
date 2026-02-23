import { MainSiteShell } from "../_components/main-site-shell";
import { OrgDetail, OrgSidebar } from "../_components/route-shell-content";

export default function OrgPage({
	params,
}: {
	params: Promise<{ owner: string }>;
}) {
	const navContextPromise = params.then(({ owner }) => ({
		owner,
		name: null,
	}));

	return (
		<MainSiteShell
			sidebar={<OrgSidebar />}
			detail={<OrgDetail params={params} />}
			navContextPromise={navContextPromise}
		/>
	);
}
