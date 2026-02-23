import { serverQueries } from "@/lib/server-queries";
import { WorkflowRunDetailClient } from "./workflow-run-detail-client";

export default function ActionRunDetailPage(props: {
	params: Promise<{ owner: string; name: string; runId: string }>;
}) {
	return <WorkflowRunDetailContent paramsPromise={props.params} />;
}

async function WorkflowRunDetailContent({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string; runId: string }>;
}) {
	const params = await paramsPromise;
	const { owner, name } = params;
	const runNumber = Number.parseInt(params.runId, 10);

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
