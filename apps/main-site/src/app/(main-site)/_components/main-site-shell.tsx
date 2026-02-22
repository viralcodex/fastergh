import type { ReactNode } from "react";
import { HubShell } from "./hub-shell";

export function MainSiteShell({
	sidebar,
	detail,
}: {
	sidebar: ReactNode;
	detail: ReactNode;
}) {
	return <HubShell sidebar={sidebar} detail={detail} />;
}
