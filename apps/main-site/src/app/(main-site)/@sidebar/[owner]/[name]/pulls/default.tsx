import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { PrListClient } from "../../../../_components/pr-list-client";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../../_components/skeletons";

/**
 * Sidebar for the pull requests list.
 *
 * Synchronous so the outer sidebar Suspense boundary is never triggered.
 * The cached `RepoListShell` renders the tab bar instantly, and all async
 * work happens inside the inner `<Suspense>`.
 *
 * `activeNumberPromise` lets detail pages (e.g. pull/[number]) pass their
 * params through without awaiting — number extraction happens inside Suspense.
 */
export default function PrListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activePullNumber?: number | null;
	activeNumberPromise?: Promise<{ number: string }>;
}) {
	return (
		<RepoListShell paramsPromise={props.params} activeTab="pulls">
			<Suspense fallback={<ListSkeleton />}>
				<PrListContent
					paramsPromise={props.params}
					activePullNumber={props.activePullNumber ?? null}
					activeNumberPromise={props.activeNumberPromise}
				/>
			</Suspense>
		</RepoListShell>
	);
}

async function PrListContent({
	paramsPromise,
	activePullNumber,
	activeNumberPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activePullNumber: number | null;
	activeNumberPromise?: Promise<{ number: string }>;
}) {
	const { owner, name } = await paramsPromise;

	let resolvedActive = activePullNumber;
	if (activeNumberPromise) {
		const { number } = await activeNumberPromise;
		const parsed = Number.parseInt(number, 10);
		resolvedActive = Number.isNaN(parsed) ? null : parsed;
	}

	const initialPrs = await serverQueries.listPullRequests
		.queryPromise({
			ownerLogin: owner,
			name,
			state: "open",
		})
		.catch(() => []);

	return (
		<PrListClient
			owner={owner}
			name={name}
			initialData={initialPrs}
			activePullNumber={resolvedActive}
		/>
	);
}
