import { Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import { IssueListClient } from "../../../../_components/issue-list-client";
import { RepoListShell } from "../../../../_components/repo-list-shell";
import { ListSkeleton } from "../../../../_components/skeletons";
import { SidebarRepoList } from "../../../sidebar-repo-list";

export default function IssueListDefault(props: {
	params: Promise<{ owner: string; name: string }>;
	activeIssueNumberPromise?: Promise<number | null>;
}) {
	return (
		<IssueListEntry
			paramsPromise={props.params}
			activeIssueNumberPromise={props.activeIssueNumberPromise}
		/>
	);
}

/** Entry — resolves params and routes to cached shell or fallback. */
async function IssueListEntry({
	paramsPromise,
	activeIssueNumberPromise,
}: {
	paramsPromise: Promise<{ owner: string; name: string }>;
	activeIssueNumberPromise?: Promise<number | null>;
}) {
	const { owner, name } = await paramsPromise;
	const activeIssueNumber = activeIssueNumberPromise
		? await activeIssueNumberPromise
		: null;

	if (!owner || !name || owner.length === 0 || name.length === 0) {
		return <FallbackRepoList />;
	}

	return (
		<RepoListShell paramsPromise={paramsPromise} activeTab="issues">
			<Suspense fallback={<ListSkeleton />}>
				<IssueListContent
					owner={owner}
					name={name}
					activeIssueNumber={activeIssueNumber ?? null}
				/>
			</Suspense>
		</RepoListShell>
	);
}

async function FallbackRepoList() {
	const initialRepos = await serverQueries.listRepos.queryPromise({});
	return <SidebarRepoList initialRepos={initialRepos} />;
}

async function IssueListContent({
	owner,
	name,
	activeIssueNumber,
}: {
	owner: string;
	name: string;
	activeIssueNumber: number | null;
}) {
	const [initialData, overview] = await Promise.all([
		serverQueries.listIssues
			.queryPromise({
				ownerLogin: owner,
				name,
				state: "open",
			})
			.catch(() => []),
		serverQueries.getRepoOverview
			.queryPromise({
				ownerLogin: owner,
				name,
			})
			.catch(() => null),
	]);

	return (
		<IssueListClient
			owner={owner}
			name={name}
			initialData={initialData}
			repositoryId={overview?.repositoryId ?? null}
			activeIssueNumber={activeIssueNumber}
		/>
	);
}
