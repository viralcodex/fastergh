import { serverNotifications } from "@/lib/server-notifications";
import { NotificationsClient } from "./notifications-client";

export default function NotificationsDefault() {
	return <NotificationsContent />;
}

async function NotificationsContent() {
	const initialNotifications =
		await serverNotifications.listNotifications.queryPromise({});
	return <NotificationsClient initialNotifications={initialNotifications} />;
}
