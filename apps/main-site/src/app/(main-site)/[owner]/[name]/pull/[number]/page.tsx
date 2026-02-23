import { api } from "@packages/database/convex/_generated/api";
import { Suspense } from "react";
import { fetchAuthMutation } from "@/lib/auth-server";
import { serverQueries } from "@/lib/server-queries";
import { PrDetailSkeleton } from "../../../../_components/skeletons";
import { PrDetailClient } from "./pr-detail-client";

export default async function PrDetailPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const { owner, name, number: numberStr } = await props.params;
	const num = Number.parseInt(numberStr, 10);

	return (
		<div className="h-full">
			<Suspense fallback={<PrDetailSkeleton />}>
				<PrDetailContent owner={owner} name={name} prNumber={num} />
			</Suspense>
		</div>
	);
}

async function PrDetailContent({
	owner,
	name,
	prNumber,
}: {
	owner: string;
	name: string;
	prNumber: number;
}) {
	const [initialPr, initialFiles] = await Promise.all([
		serverQueries.getPullRequestDetail.queryPromise({
			ownerLogin: owner,
			name,
			number: prNumber,
		}),
		serverQueries.listPrFiles.queryPromise({
			ownerLogin: owner,
			name,
			number: prNumber,
		}),
	]);

	if (initialPr !== null && initialFiles.files.length === 0) {
		await fetchAuthMutation(api.rpc.projectionQueries.requestPrFileSync, {
			ownerLogin: owner,
			name,
			number: prNumber,
		}).catch(() => null);
	}

	return (
		<PrDetailClient
			owner={owner}
			name={name}
			prNumber={prNumber}
			initialPr={initialPr}
			initialFiles={initialFiles}
		/>
	);
}
