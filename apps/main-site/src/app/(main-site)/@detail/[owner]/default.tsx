import { Skeleton } from "@packages/ui/components/skeleton";
import { cacheLife } from "next/cache";
import { type ReactNode, Suspense } from "react";
import { serverQueries } from "@/lib/server-queries";
import type { DashboardData } from "../home-dashboard-client";
import {
	CommandPaletteClient,
	IssuesColumnClient,
	PrColumnClient,
	ReposColumnClient,
	SignInCta,
} from "../home-dashboard-client";

/**
 * Detail panel for the org overview page (/:owner).
 *
 * Entry component resolves params and creates dynamic slots. The cached
 * shell serves instantly; data sections stream in via Suspense.
 */
export default function OrgDetailDefault(props: {
	params: Promise<{ owner: string }>;
}) {
	return <OrgDetailEntry paramsPromise={props.params} />;
}

/** Request-aware entry — resolves params, builds dynamic slots. */
async function OrgDetailEntry({
	paramsPromise,
}: {
	paramsPromise: Promise<{ owner: string }>;
}) {
	const { owner } = await paramsPromise;

	return (
		<OrgDetailShell
			commandPalette={
				<Suspense fallback={<Skeleton className="h-10 w-full rounded-lg" />}>
					<OrgCommandPaletteSection owner={owner} />
				</Suspense>
			}
			prColumn={
				<Suspense fallback={<ColumnSkeleton />}>
					<OrgPrColumnSection owner={owner} />
				</Suspense>
			}
			issuesColumn={
				<Suspense fallback={<ColumnSkeleton />}>
					<OrgIssuesColumnSection owner={owner} />
				</Suspense>
			}
			reposColumn={
				<Suspense fallback={<ColumnSkeleton />}>
					<OrgReposColumnSection owner={owner} />
				</Suspense>
			}
		/>
	);
}

/** Cached static shell — deterministic layout, no request-specific data. */
async function OrgDetailShell({
	commandPalette,
	prColumn,
	issuesColumn,
	reposColumn,
}: {
	commandPalette: ReactNode;
	prColumn: ReactNode;
	issuesColumn: ReactNode;
	reposColumn: ReactNode;
}) {
	"use cache";
	cacheLife("max");

	return (
		<div className="h-full overflow-y-auto bg-dotgrid">
			<div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-5">
				{/* Command palette */}
				<div className="mb-4">{commandPalette}</div>

				{/* Sign-in CTA — renders nothing if signed in */}
				<SignInCta />

				{/* Three-column grid */}
				<div className="grid gap-4 lg:grid-cols-3">
					{prColumn}
					{issuesColumn}
					{reposColumn}
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Async server components — each fetches the same (deduped) query
// ---------------------------------------------------------------------------

async function fetchOrgDashboard(owner: string): Promise<DashboardData> {
	return serverQueries.getHomeDashboard.queryPromise({ ownerLogin: owner });
}

async function OrgCommandPaletteSection({ owner }: { owner: string }) {
	const data = await fetchOrgDashboard(owner);
	return (
		<CommandPaletteClient initialData={data} query={{ ownerLogin: owner }} />
	);
}

async function OrgPrColumnSection({ owner }: { owner: string }) {
	const data = await fetchOrgDashboard(owner);
	return <PrColumnClient initialData={data} query={{ ownerLogin: owner }} />;
}

async function OrgIssuesColumnSection({ owner }: { owner: string }) {
	const data = await fetchOrgDashboard(owner);
	return (
		<IssuesColumnClient initialData={data} query={{ ownerLogin: owner }} />
	);
}

async function OrgReposColumnSection({ owner }: { owner: string }) {
	const data = await fetchOrgDashboard(owner);
	return <ReposColumnClient initialData={data} query={{ ownerLogin: owner }} />;
}

function ColumnSkeleton() {
	return (
		<div className="space-y-0">
			<Skeleton className="mb-1.5 h-4 w-28" />
			<Skeleton className="h-72 rounded-lg" />
		</div>
	);
}
