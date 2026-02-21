import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { SidebarClient, SidebarSkeleton } from "./sidebar-client";

/**
 * Persistent sidebar layout — renders the SidebarClient shell once.
 * Route-specific body content is swapped via `{children}` without
 * re-suspending the nav selector or footer.
 */
export default function SidebarLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={<SidebarSkeleton />}>
			<SidebarShell>{children}</SidebarShell>
		</Suspense>
	);
}

async function SidebarShell({ children }: { children: ReactNode }) {
	await connection();
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarClient initialRepos={initialRepos}>{children}</SidebarClient>;
}
