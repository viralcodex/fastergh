import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { WorkflowRunDetailSkeleton } from "../../../../../_components/skeletons";
import { WorkflowRunDetailClient } from "./workflow-run-detail-client";

export default async function ActionRunDetailPage(props: {
	params: Promise<{ owner: string; name: string; runId: string }>;
}) {
	const { owner, name, runId } = await props.params;
	const runNumber = Number.parseInt(runId, 10);

	if (Number.isNaN(runNumber)) {
		return (
			<WorkflowRunDetailClient
				owner={owner}
				name={name}
				runNumber={0}
				initialRun={null}
			/>
		);
	}

	return (
		<div className="h-full">
			<Suspense fallback={<WorkflowRunDetailSkeleton />}>
				<WorkflowRunDetailContent
					owner={owner}
					name={name}
					runNumber={runNumber}
				/>
			</Suspense>
		</div>
	);
}

async function WorkflowRunDetailContent({
	owner,
	name,
	runNumber,
}: {
	owner: string;
	name: string;
	runNumber: number;
}) {
	const initialRun = await serverQueries.getWorkflowRunDetail
		.queryPromise({
			ownerLogin: owner,
			name,
			runNumber,
		})
		.catch(() => null);

	return (
		<WorkflowRunDetailClient
			owner={owner}
			name={name}
			runNumber={runNumber}
			initialRun={initialRun}
		/>
	);
}
