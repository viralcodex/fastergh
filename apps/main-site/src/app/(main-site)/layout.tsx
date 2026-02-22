import { Providers } from "@packages/ui/components/providers";
import type { Metadata } from "next";
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
			<div className="hidden">{children}</div>
		</Providers>
	);
}
