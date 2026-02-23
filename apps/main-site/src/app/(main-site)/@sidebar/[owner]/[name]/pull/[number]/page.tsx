import PrListDefault from "../../pulls/default";

/**
 * Sidebar when viewing a specific PR — shows the PR list with this PR highlighted.
 *
 * Synchronous default export: passes params through as promises so that
 * number extraction happens inside the already-Suspensed async content.
 */
export default function PullDetailSidebarPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	return (
		<PrListDefault params={props.params} activeNumberPromise={props.params} />
	);
}
