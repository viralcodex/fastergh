import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { IssueDetailSkeleton } from "../../../../_components/skeletons";
import { IssueDetailClient } from "./issue-detail-client";

export default async function IssueDetailPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const { owner, name, number: numberStr } = await props.params;
	const num = Number.parseInt(numberStr, 10);

	return (
		<div className="h-full">
			<Suspense fallback={<IssueDetailSkeleton />}>
				<IssueDetailContent owner={owner} name={name} issueNumber={num} />
			</Suspense>
		</div>
	);
}

async function IssueDetailContent({
	owner,
	name,
	issueNumber,
}: {
	owner: string;
	name: string;
	issueNumber: number;
}) {
	const initialIssue = await serverQueries.getIssueDetail.queryPromise({
		ownerLogin: owner,
		name,
		number: issueNumber,
	});

	return (
		<IssueDetailClient
			owner={owner}
			name={name}
			issueNumber={issueNumber}
			initialIssue={initialIssue}
		/>
	);
}
