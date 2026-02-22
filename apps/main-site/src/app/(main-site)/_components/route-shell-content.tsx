import ActionsDetailDefault from "../@detail/[owner]/[name]/actions/default";
import WorkflowRunDetailPage from "../@detail/[owner]/[name]/actions/runs/[runId]/page";
import BlobDetailPage from "../@detail/[owner]/[name]/blob/[ref]/[[...path]]/page";
import RepoDetailDefault from "../@detail/[owner]/[name]/default";
import IssueDetailPage from "../@detail/[owner]/[name]/issues/[number]/page";
import IssuesDetailDefault from "../@detail/[owner]/[name]/issues/default";
import NewIssuePage from "../@detail/[owner]/[name]/issues/new/page";
import PrDetailPage from "../@detail/[owner]/[name]/pull/[number]/page";
import PullsDetailDefault from "../@detail/[owner]/[name]/pulls/default";
import TreeDetailPage from "../@detail/[owner]/[name]/tree/[ref]/[[...path]]/page";
import OrgDetailDefault from "../@detail/[owner]/default";
import HomeDetailDefault from "../@detail/default";
import NotificationsDetailDefault from "../@detail/notifications/default";
import ActionsSidebarDefault from "../@sidebar/[owner]/[name]/actions/default";
import BlobSidebarPage from "../@sidebar/[owner]/[name]/blob/[ref]/[[...path]]/page";
import RepoSidebarDefault from "../@sidebar/[owner]/[name]/default";
import IssuesSidebarDefault from "../@sidebar/[owner]/[name]/issues/default";
import PullsSidebarDefault from "../@sidebar/[owner]/[name]/pulls/default";
import TreeSidebarPage from "../@sidebar/[owner]/[name]/tree/[ref]/[[...path]]/page";
import OrgSidebarDefault from "../@sidebar/[owner]/default";
import HomeSidebarDefault from "../@sidebar/default";
import NotificationsSidebarDefault from "../@sidebar/notifications/default";

type OrgParamsPromise = Promise<{ owner: string }>;
type RepoParamsPromise = Promise<{ owner: string; name: string }>;
type IssueDetailParamsPromise = Promise<{
	owner: string;
	name: string;
	number: string;
}>;
type PullDetailParamsPromise = Promise<{
	owner: string;
	name: string;
	number: string;
}>;
type ActionRunParamsPromise = Promise<{
	owner: string;
	name: string;
	runId: string;
}>;
type TreeParamsPromise = Promise<{
	owner: string;
	name: string;
	ref: string;
}>;
type BlobParamsPromise = Promise<{
	owner: string;
	name: string;
	ref: string;
	path?: Array<string>;
}>;

export function RootSidebar() {
	return <HomeSidebarDefault />;
}

export function RootDetail() {
	return <HomeDetailDefault />;
}

export function NotificationsSidebar() {
	return <NotificationsSidebarDefault />;
}

export function NotificationsDetail() {
	return <NotificationsDetailDefault />;
}

export function OrgSidebar() {
	return <OrgSidebarDefault />;
}

export function OrgDetail({ params }: { params: OrgParamsPromise }) {
	return <OrgDetailDefault params={params} />;
}

export function RepoOverviewSidebar({ params }: { params: RepoParamsPromise }) {
	return <RepoSidebarDefault params={params} />;
}

export function RepoOverviewDetail({ params }: { params: RepoParamsPromise }) {
	return <RepoDetailDefault params={params} />;
}

export function PullsSidebar({ params }: { params: RepoParamsPromise }) {
	return <PullsSidebarDefault params={params} />;
}

export function PullsSidebarWithActive({
	params,
	activePullNumberPromise,
}: {
	params: RepoParamsPromise;
	activePullNumberPromise: Promise<number | null>;
}) {
	return (
		<PullsSidebarDefault
			params={params}
			activePullNumberPromise={activePullNumberPromise}
		/>
	);
}

export function PullsDetail({ params }: { params: RepoParamsPromise }) {
	return <PullsDetailDefault params={params} />;
}

export function IssuesSidebar({ params }: { params: RepoParamsPromise }) {
	return <IssuesSidebarDefault params={params} />;
}

export function IssuesSidebarWithActive({
	params,
	activeIssueNumberPromise,
}: {
	params: RepoParamsPromise;
	activeIssueNumberPromise: Promise<number | null>;
}) {
	return (
		<IssuesSidebarDefault
			params={params}
			activeIssueNumberPromise={activeIssueNumberPromise}
		/>
	);
}

export function IssuesDetail({ params }: { params: RepoParamsPromise }) {
	return <IssuesDetailDefault params={params} />;
}

export function ActionsSidebar({ params }: { params: RepoParamsPromise }) {
	return <ActionsSidebarDefault params={params} />;
}

export function ActionsSidebarWithActive({
	params,
	activeRunNumberPromise,
}: {
	params: RepoParamsPromise;
	activeRunNumberPromise: Promise<number | null>;
}) {
	return (
		<ActionsSidebarDefault
			params={params}
			activeRunNumberPromise={activeRunNumberPromise}
		/>
	);
}

export function ActionsDetail({ params }: { params: RepoParamsPromise }) {
	return <ActionsDetailDefault params={params} />;
}

export function IssueDetail({ params }: { params: IssueDetailParamsPromise }) {
	return <IssueDetailPage params={params} />;
}

export function PullDetail({ params }: { params: PullDetailParamsPromise }) {
	return <PrDetailPage params={params} />;
}

export function ActionRunDetail({
	params,
}: {
	params: ActionRunParamsPromise;
}) {
	return <WorkflowRunDetailPage params={params} />;
}

export function NewIssueDetail({ params }: { params: RepoParamsPromise }) {
	return <NewIssuePage params={params} />;
}

export function TreeSidebar({ params }: { params: RepoParamsPromise }) {
	return <TreeSidebarPage params={params} />;
}

export function BlobSidebar({ params }: { params: RepoParamsPromise }) {
	return <BlobSidebarPage params={params} />;
}

export function TreeDetail({ params }: { params: TreeParamsPromise }) {
	return <TreeDetailPage params={params} />;
}

export function BlobDetail({ params }: { params: BlobParamsPromise }) {
	return <BlobDetailPage params={params} />;
}
