import ActionsListDefault from "../../default";

/**
 * Sidebar when viewing a specific workflow run — shows the runs list with this run highlighted.
 *
 * Synchronous default export: passes params through as promises so that
 * runId extraction happens inside the already-Suspensed async content.
 */
export default function ActionRunSidebarPage(props: {
	params: Promise<{ owner: string; name: string; runId: string }>;
}) {
	return (
		<ActionsListDefault
			params={props.params}
			activeRunIdPromise={props.params}
		/>
	);
}
