import { CircleDot } from "@packages/ui/components/icons";
import { cacheLife } from "next/cache";
import { SyncProgressOverlay } from "../../../_components/sync-progress-client";

export default function IssuesPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return <IssuesContent paramsPromise={params} />;
}

async function IssuesContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	"use cache";
	cacheLife("max");

	const { owner, name } = await paramsPromise;

	return (
		<SyncProgressOverlay owner={owner} name={name}>
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<CircleDot className="mx-auto size-10 text-muted-foreground/30" />
					<p className="mt-3 text-sm text-muted-foreground">
						Select an issue to view details
					</p>
				</div>
			</div>
		</SyncProgressOverlay>
	);
}
