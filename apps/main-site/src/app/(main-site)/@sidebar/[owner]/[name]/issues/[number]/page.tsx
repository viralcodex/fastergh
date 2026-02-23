import IssueListDefault from "../default";

/**
 * Sidebar when viewing a specific issue — shows the issue list with this issue highlighted.
 *
 * Synchronous default export: passes params through as promises so that
 * number extraction happens inside the already-Suspensed async content.
 */
export default function IssueDetailSidebarPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	return (
		<IssueListDefault
			params={props.params}
			activeNumberPromise={props.params}
		/>
	);
}
