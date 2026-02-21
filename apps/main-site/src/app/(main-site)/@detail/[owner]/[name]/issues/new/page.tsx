import { Skeleton } from "@packages/ui/components/skeleton";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { NewIssueClient } from "./new-issue-client";

export default function NewIssueSlot(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return (
		<Suspense fallback={<NewIssueSkeleton />}>
			<NewIssueContent paramsPromise={props.params} />
		</Suspense>
	);
}

function NewIssueSkeleton() {
	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
				<Skeleton className="h-6 w-32 mb-1" />
				<Skeleton className="h-3 w-48 mb-6" />
				<div className="space-y-2">
					<Skeleton className="h-16 w-full rounded-lg" />
					<Skeleton className="h-16 w-full rounded-lg" />
					<Skeleton className="h-16 w-full rounded-lg" />
				</div>
			</div>
		</div>
	);
}

async function NewIssueContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await paramsPromise;

	const overview = await serverQueries.getRepoOverview.queryPromise({
		ownerLogin: owner,
		name,
	});

	if (overview === null || overview.repositoryId === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-sm text-muted-foreground">
					Repository not found or not synced yet.
				</p>
			</div>
		);
	}

	return (
		<NewIssueClient
			owner={owner}
			name={name}
			repositoryId={overview.repositoryId}
		/>
	);
}
