import { Providers } from "@packages/ui/components/providers";
import type { Metadata } from "next";
import { type ReactNode, Suspense } from "react";
import { HubShell } from "./_components/hub-shell";
import { MainSiteSidebar } from "./_components/main-site-sidebar";

export const metadata: Metadata = {
	title: "FasterGH — GitHub Mirror",
	description: "Fast GitHub browsing backed by Convex real-time projections",
};

function SidebarShellFallback() {
	return <div className="h-full animate-pulse bg-sidebar/60" />;
}

function DetailShellFallback() {
	return <div className="h-full animate-pulse bg-background" />;
}

/**
 * Root layout for the main site.
 *
 * Uses a single `@sidebar` parallel route for the sidebar panel content,
 * resolved automatically by the Next.js router. The sidebar persists across
 * navigations — only the detail panel (children / page.tsx) re-renders.
 *
 * `children` maps to `page.tsx` files and renders the main detail content.
 */
export default function MainSiteLayout({
	children,
	sidebar,
}: {
	children: ReactNode;
	sidebar: ReactNode;
}) {
	return (
		<Providers>
			<HubShell
				sidebar={
					<Suspense fallback={<SidebarShellFallback />}>
						<MainSiteSidebar>{sidebar}</MainSiteSidebar>
					</Suspense>
				}
				detail={
					<Suspense fallback={<DetailShellFallback />}>{children}</Suspense>
				}
			/>
		</Providers>
	);
}
