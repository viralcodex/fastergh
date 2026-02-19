import { Providers } from "@packages/ui/components/providers";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HubShell } from "./_components/hub-shell";

export const metadata: Metadata = {
	title: "QuickHub — GitHub Mirror",
	description: "Fast GitHub browsing backed by Convex real-time projections",
};

export default function MainSiteLayout({
	children,
	sidebar,
	detail,
}: {
	children: React.ReactNode;
	sidebar: React.ReactNode;
	detail: React.ReactNode;
}) {
	return (
		<Providers>
			<HubShell sidebar={sidebar} detail={detail} />
			{/* children slot for route pages that handle redirects etc */}
			<div className="hidden">
				<Suspense>{children}</Suspense>
			</div>
		</Providers>
	);
}
