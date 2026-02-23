import { GitPullRequest } from "@packages/ui/components/icons";
import { cacheLife } from "next/cache";
import { SyncProgressOverlay } from "../../../_components/sync-progress-client";

export default function PullsPage({
	params,
}: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return <PullsContent paramsPromise={params} />;
}

async function PullsContent({
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
					<GitPullRequest className="mx-auto size-10 text-muted-foreground/30" />
					<p className="mt-3 text-sm text-muted-foreground">
						Select a pull request to view details
					</p>
				</div>
			</div>
		</SyncProgressOverlay>
	);
}
