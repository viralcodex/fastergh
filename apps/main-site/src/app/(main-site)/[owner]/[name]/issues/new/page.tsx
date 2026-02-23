import { Skeleton } from "@packages/ui/components/skeleton";
import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { NewIssueClient } from "./new-issue-client";

export default async function NewIssuePage(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	const { owner, name } = await props.params;

	return (
		<div className="h-full overflow-y-auto">
			<Suspense fallback={<NewIssueSkeleton />}>
				<NewIssueContent owner={owner} name={name} />
			</Suspense>
		</div>
	);
}

async function NewIssueContent({
	owner,
	name,
}: {
	owner: string;
	name: string;
}) {
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

function NewIssueSkeleton() {
	return (
		<div className="animate-pulse p-4 space-y-4">
			{/* Title input */}
			<Skeleton className="h-9 w-full rounded-md" />
			{/* Template tabs */}
			<div className="flex gap-2">
				<Skeleton className="h-7 w-20 rounded" />
				<Skeleton className="h-7 w-24 rounded" />
			</div>
			{/* Body textarea */}
			<Skeleton className="h-48 w-full rounded-md" />
			{/* Metadata selectors row */}
			<div className="flex gap-3">
				<Skeleton className="h-8 w-28 rounded" />
				<Skeleton className="h-8 w-28 rounded" />
			</div>
			{/* Submit button */}
			<div className="flex justify-end">
				<Skeleton className="h-9 w-28 rounded" />
			</div>
		</div>
	);
}
