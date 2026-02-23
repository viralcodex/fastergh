import { MainSiteShell } from "./_components/main-site-shell";
import { RootDetail, RootSidebar } from "./_components/route-shell-content";

export default function HomePage() {
	return <MainSiteShell sidebar={<RootSidebar />} detail={<RootDetail />} />;
}
