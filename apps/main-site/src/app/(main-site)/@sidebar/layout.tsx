import type { ReactNode } from "react";
import { serverQueries } from "@/lib/server-queries";
import { SidebarClient } from "./sidebar-client";
import { NavSelectorSlot } from "./sidebar-nav-selector-slot";

/**
 * Persistent sidebar layout.
 *
 * The default export is sync and renders the static sidebar shell immediately.
 * The nav selector is fetched by a colocated async server component that is
 * mounted into the shell's header slot.
 */
export default function SidebarLayout({ children }: { children: ReactNode }) {
	return (
		<SidebarClient navSelector={<NavSelectorContent />}>
			{children}
		</SidebarClient>
	);
}

async function NavSelectorContent() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});

	if (initialRepos.length === 0) {
		return null;
	}

	return (
		<div className="shrink-0 border-b border-sidebar-border">
			<NavSelectorSlot initialRepos={initialRepos} />
		</div>
	);
}
