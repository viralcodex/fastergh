import { connection } from "next/server";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { SidebarClient, SidebarSkeleton } from "../sidebar-client";
import { SidebarRepoList } from "../sidebar-repo-list";

export default function NotificationsSidebarDefault() {
	return (
		<Suspense fallback={<SidebarSkeleton />}>
			<SidebarContent />
		</Suspense>
	);
}

async function SidebarContent() {
	await connection();
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return (
		<SidebarClient initialRepos={initialRepos}>
			<SidebarRepoList initialRepos={initialRepos} />
		</SidebarClient>
	);
}
