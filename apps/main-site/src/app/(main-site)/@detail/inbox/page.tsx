import { connection } from "next/server";
import { Suspense } from "react";
import { serverNotifications } from "@/lib/server-notifications";
import { InboxClient, InboxSkeleton } from "./inbox-client";

export default function InboxPage() {
	return (
		<Suspense fallback={<InboxSkeleton />}>
			<InboxContent />
		</Suspense>
	);
}

async function InboxContent() {
	await connection();
	const initialNotifications =
		await serverNotifications.listNotifications.queryPromise({});
	return <InboxClient initialNotifications={initialNotifications} />;
}
