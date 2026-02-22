import { MainSiteShell } from "../_components/main-site-shell";
import { OrgDetail, OrgSidebar } from "../_components/route-shell-content";

export default function OrgPage({
	params,
}: {
	params: Promise<{ owner: string }>;
}) {
	return (
		<MainSiteShell
			sidebar={<OrgSidebar />}
			detail={<OrgDetail params={params} />}
		/>
	);
}
