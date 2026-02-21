import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { WorkflowRunDetailSkeleton } from "../../../../../_components/skeletons";
import { WorkflowRunDetailClient } from "./workflow-run-detail-client";

export default function WorkflowRunDetailSlot(props: {
	params: Promise<{ owner: string; name: string; runNumber: string }>;
}) {
	return (
		<Suspense fallback={<WorkflowRunDetailSkeleton />}>
			<WorkflowRunDetailContent paramsPromise={props.params} />
		</Suspense>
	);
}

async function WorkflowRunDetailContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string; runNumber: string }>;
}) {
	const params = await paramsPromise;
	const { owner, name } = params;
	const runNumber = Number.parseInt(params.runNumber, 10);

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
