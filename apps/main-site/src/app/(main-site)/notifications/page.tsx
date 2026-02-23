import { Skeleton } from "@packages/ui/components/skeleton";
import { Suspense } from "react";
import { serverNotifications } from "@/lib/server-notifications";
import { NotificationsClient } from "./notifications-client";

export default function NotificationsPage() {
	return (
		<div className="h-full overflow-y-auto">
			<Suspense fallback={<NotificationsSkeleton />}>
				<NotificationsContent />
			</Suspense>
		</div>
	);
}

async function NotificationsContent() {
	const initialNotifications =
		await serverNotifications.listNotifications.queryPromise({});
	return <NotificationsClient initialNotifications={initialNotifications} />;
}

function NotificationsSkeleton() {
	return (
		<div className="animate-pulse p-4 space-y-3">
			{/* Header area */}
			<div className="flex items-center justify-between mb-2">
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-7 w-20 rounded" />
			</div>
			{/* Notification rows */}
			{Array.from({ length: 8 }, (_, i) => (
				<div key={i} className="flex items-start gap-3 rounded-md p-2">
					<Skeleton className="size-8 rounded-full shrink-0" />
					<div className="flex-1 space-y-1.5">
						<Skeleton className="h-3.5 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
					</div>
					<Skeleton className="h-3 w-12 shrink-0" />
				</div>
			))}
		</div>
	);
}
