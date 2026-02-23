import { serverQueries } from "@/lib/server-queries";
import { IssueDetailClient } from "./issue-detail-client";

export default function IssueDetailSlot(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	return <IssueDetailContent paramsPromise={props.params} />;
}

async function IssueDetailContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string; number: string }>;
}) {
	const params = await paramsPromise;
	const { owner, name } = params;
	const num = Number.parseInt(params.number, 10);

	const initialIssue = await serverQueries.getIssueDetail.queryPromise({
		ownerLogin: owner,
		name,
		number: num,
	});

	return (
		<IssueDetailClient
			owner={owner}
			name={name}
			issueNumber={num}
			initialIssue={initialIssue}
		/>
	);
}
