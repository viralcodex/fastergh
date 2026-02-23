import { MainSiteShell } from "../_components/main-site-shell";
import {
	NotificationsDetail,
	NotificationsSidebar,
} from "../_components/route-shell-content";

export default function NotificationsPage() {
	return (
		<MainSiteShell
			sidebar={<NotificationsSidebar />}
			detail={<NotificationsDetail />}
		/>
	);
}
