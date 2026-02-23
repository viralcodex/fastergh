import { serverQueries } from "@/lib/server-queries";
import { NewIssueClient } from "./new-issue-client";

export default function NewIssuePage(props: {
	params: Promise<{ owner: string; name: string }>;
}) {
	return <NewIssueContent paramsPromise={props.params} />;
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
