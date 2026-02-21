"use client";

import { Result, useAtom } from "@effect-atom/atom-react";
import { useSubscriptionWithInitial } from "@packages/confect/rpc";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardHeader } from "@packages/ui/components/card";
import { Input } from "@packages/ui/components/input";
import { Link } from "@packages/ui/components/link";
import { cn } from "@packages/ui/lib/utils";
import { useGithubActions } from "@packages/ui/rpc/github-actions";
import { useProjectionQueries } from "@packages/ui/rpc/projection-queries";
import { Option } from "effect";
import {
	ChevronDown,
	Clock,
	ExternalLink,
	GitBranch,
	Loader2,
	Play,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type WorkflowJob = {
	readonly githubJobId: number;
	readonly name: string;
	readonly status: string;
	readonly conclusion: string | null;
	readonly startedAt: number | null;
	readonly completedAt: number | null;
	readonly runnerName: string | null;
	readonly stepsJson: string | null;
};

type WorkflowRunDetail = {
	readonly repositoryId: number;
	readonly githubRunId: number;
	readonly workflowName: string | null;
	readonly runNumber: number;
	readonly runAttempt: number;
	readonly event: string;
	readonly status: string | null;
	readonly conclusion: string | null;
	readonly headBranch: string | null;
	readonly headSha: string;
	readonly actorLogin: string | null;
	readonly actorAvatarUrl: string | null;
	readonly htmlUrl: string | null;
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly jobs: readonly WorkflowJob[];
};

type Step = {
	readonly name: string;
	readonly status: string;
	readonly conclusion: string | null;
	readonly number: number;
	readonly started_at: string | null;
	readonly completed_at: string | null;
};

export function WorkflowRunDetailClient({
	owner,
	name,
	runNumber,
	initialRun,
}: {
	owner: string;
	name: string;
	runNumber: number;
	initialRun: WorkflowRunDetail | null;
}) {
	const client = useProjectionQueries();

	const runAtom = useMemo(
		() =>
			client.getWorkflowRunDetail.subscription({
				ownerLogin: owner,
				name,
				runNumber,
			}),
		[client, owner, name, runNumber],
	);

	const run = useSubscriptionWithInitial(runAtom, initialRun);

	if (run === null) {
		return (
			<div className="py-8 text-center">
				<h2 className="text-base font-semibold">Run #{runNumber}</h2>
				<p className="mt-1 text-xs text-muted-foreground">Not synced yet.</p>
			</div>
		);
	}

	return (
		<div className="h-full overflow-y-auto">
			<div className="p-4">
				{/* Header */}
				<div className="flex items-start gap-2.5">
					<RunConclusionIconLarge
						status={run.status}
						conclusion={run.conclusion}
					/>
					<div className="min-w-0 flex-1">
						<h1 className="text-base font-bold break-words leading-snug tracking-tight">
							{run.workflowName ?? `Workflow Run`}
						</h1>
						<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<span className="tabular-nums">#{run.runNumber}</span>
							<RunStatusBadge status={run.status} conclusion={run.conclusion} />
							{run.actorLogin && (
								<span className="flex items-center gap-1">
									<Avatar className="size-4">
										<AvatarImage src={run.actorAvatarUrl ?? undefined} />
										<AvatarFallback className="text-[8px]">
											{run.actorLogin[0]?.toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="font-medium">{run.actorLogin}</span>
								</span>
							)}
							<span className="text-muted-foreground/40">&middot;</span>
							<span>{formatRelative(run.updatedAt)}</span>
						</div>
					</div>
					{run.htmlUrl && (
						<Link
							href={run.htmlUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
							aria-label="View on GitHub"
						>
							<ExternalLink className="size-4" />
						</Link>
					)}
				</div>

				{/* Metadata row */}
				<div className="mt-3 flex flex-wrap items-center gap-2">
					{run.headBranch && (
						<Badge variant="outline" className="text-[10px] gap-1">
							<GitBranch className="size-3" />
							{run.headBranch}
						</Badge>
					)}
					<Badge variant="outline" className="text-[10px] font-mono">
						{run.headSha.slice(0, 7)}
					</Badge>
					<Badge variant="outline" className="text-[10px] gap-1">
						<Play className="size-3" />
						{run.event}
					</Badge>
					{run.runAttempt > 1 && (
						<Badge variant="outline" className="text-[10px]">
							Attempt #{run.runAttempt}
						</Badge>
					)}
				</div>

				{/* Jobs */}
				{run.jobs.length > 0 && (
					<div className="mt-5">
						<h2 className="text-sm font-semibold mb-2">
							Jobs
							<span className="ml-2 text-xs font-normal text-muted-foreground">
								({run.jobs.length})
							</span>
						</h2>
						<div className="space-y-2">
							{run.jobs.map((job) => (
								<JobCard
									key={job.githubJobId}
									job={job}
									owner={owner}
									name={name}
									githubRunId={run.githubRunId}
								/>
							))}
						</div>
					</div>
				)}

				{run.jobs.length === 0 && (
					<p className="mt-5 py-8 text-center text-xs text-muted-foreground">
						No jobs recorded for this run.
					</p>
				)}
			</div>
		</div>
	);
}

function JobCard({
	job,
	owner,
	name,
	githubRunId,
}: {
	job: WorkflowJob;
	owner: string;
	name: string;
	githubRunId: number;
}) {
	const [expanded, setExpanded] = useState(false);
	const hasSteps =
		job.stepsJson !== null && job.stepsJson !== "" && job.stepsJson !== "[]";
	const steps = useMemo(
		() => (expanded ? parseSteps(job.stepsJson) : []),
		[expanded, job.stepsJson],
	);
	const duration = computeDuration(job.startedAt, job.completedAt);
	const logsUrl = `https://github.com/${owner}/${name}/actions/runs/${githubRunId}/job/${job.githubJobId}`;

	return (
		<Card>
			<CardHeader className="pb-0">
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="sm"
						type="button"
						className="h-auto w-full min-w-0 flex-1 cursor-pointer justify-start gap-2 p-0 text-left hover:bg-transparent"
						onClick={() => setExpanded((prev) => !prev)}
					>
						<JobConclusionIcon
							status={job.status}
							conclusion={job.conclusion}
						/>
						<span className="text-sm font-medium truncate flex-1">
							{job.name}
						</span>
						{duration && (
							<span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
								<Clock className="size-3" />
								{duration}
							</span>
						)}
						{job.conclusion && <ConclusionBadge conclusion={job.conclusion} />}
						{hasSteps && (
							<ChevronDown
								className={cn(
									"size-3.5 text-muted-foreground transition-transform duration-200 shrink-0",
									expanded && "rotate-180",
								)}
							/>
						)}
					</Button>
					<Link
						href={logsUrl}
						target="_blank"
						rel="noopener noreferrer"
						title="Open logs on GitHub"
						className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
					>
						<ExternalLink className="size-3.5" />
						<span className="sr-only">Open logs on GitHub</span>
					</Link>
				</div>
			</CardHeader>
			{expanded && (
				<CardContent>
					{steps.length > 0 && (
						<div className="mt-2 border rounded-md divide-y">
							{steps.map((step) => (
								<div
									key={step.number}
									className="flex items-center gap-2 px-2.5 py-1.5"
								>
									<StepConclusionIcon conclusion={step.conclusion} />
									<span className="text-xs truncate flex-1">{step.name}</span>
									{step.started_at && step.completed_at && (
										<span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
											{computeDuration(
												new Date(step.started_at).getTime(),
												new Date(step.completed_at).getTime(),
											)}
										</span>
									)}
								</div>
							))}
						</div>
					)}
					{job.runnerName && (
						<p className="mt-2 text-[10px] text-muted-foreground">
							Runner: {job.runnerName}
						</p>
					)}

					<JobLogsPanel
						owner={owner}
						name={name}
						githubRunId={githubRunId}
						githubJobId={job.githubJobId}
					/>
				</CardContent>
			)}
		</Card>
	);
}

function JobLogsPanel({
	owner,
	name,
	githubRunId,
	githubJobId,
}: {
	owner: string;
	name: string;
	githubRunId: number;
	githubJobId: number;
}) {
	const githubActions = useGithubActions();
	const [logsResult, fetchLogs] = useAtom(
		githubActions.fetchWorkflowJobLogs.call,
	);
	const [logFilter, setLogFilter] = useState("");
	const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
		"idle",
	);

	const logsValue = Result.value(logsResult);
	const logsError = Result.error(logsResult);
	const isLogsLoading = Result.isWaiting(logsResult);
	const hasLogsResult = Option.isSome(logsValue);
	const logPayload = hasLogsResult ? logsValue.value : null;
	const filteredLog = useMemo(() => {
		if (logPayload === null) return null;
		const query = logFilter.trim().toLowerCase();
		if (query === "") return logPayload.log;
		return logPayload.log
			.split("\n")
			.filter((line) => line.toLowerCase().includes(query))
			.join("\n");
	}, [logPayload, logFilter]);

	useEffect(() => {
		if (hasLogsResult || isLogsLoading || Option.isSome(logsError)) return;
		fetchLogs({
			ownerLogin: owner,
			name,
			jobId: githubJobId,
		});
	}, [
		hasLogsResult,
		isLogsLoading,
		logsError,
		fetchLogs,
		owner,
		name,
		githubJobId,
	]);

	useEffect(() => {
		if (copyState !== "copied") return;
		const timeout = window.setTimeout(() => setCopyState("idle"), 1200);
		return () => window.clearTimeout(timeout);
	}, [copyState]);

	const handleCopyLogs = () => {
		if (filteredLog === null) return;
		navigator.clipboard
			.writeText(filteredLog)
			.then(() => setCopyState("copied"))
			.catch(() => setCopyState("error"));
	};

	const handleDownloadLogs = () => {
		if (filteredLog === null) return;
		const blob = new Blob([filteredLog], { type: "text/plain;charset=utf-8" });
		const objectUrl = window.URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = objectUrl;
		anchor.download = `${owner}-${name}-run-${githubRunId}-job-${githubJobId}.log`;
		document.body.append(anchor);
		anchor.click();
		anchor.remove();
		window.URL.revokeObjectURL(objectUrl);
	};

	return (
		<div className="mt-3 border rounded-md bg-muted/20">
			<div className="flex items-center justify-between gap-2 border-b px-2.5 py-2">
				<span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
					Logs
				</span>
				<div className="flex items-center gap-1.5">
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-[10px]"
						disabled={isLogsLoading}
						onClick={() =>
							fetchLogs({
								ownerLogin: owner,
								name,
								jobId: githubJobId,
							})
						}
					>
						{isLogsLoading ? (
							<>
								<Loader2 className="size-3 animate-spin" />
								Fetching...
							</>
						) : hasLogsResult ? (
							"Refresh"
						) : (
							"Load logs"
						)}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-[10px]"
						disabled={filteredLog === null || isLogsLoading}
						onClick={handleCopyLogs}
					>
						{copyState === "copied"
							? "Copied"
							: copyState === "error"
								? "Retry copy"
								: "Copy"}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 px-2 text-[10px]"
						disabled={filteredLog === null || isLogsLoading}
						onClick={handleDownloadLogs}
					>
						Download
					</Button>
				</div>
			</div>

			{hasLogsResult && logPayload !== null && (
				<div className="px-2.5 py-2">
					<div className="mb-2 flex items-center gap-2">
						<Input
							value={logFilter}
							onChange={(event) => {
								setLogFilter(event.target.value);
								if (copyState !== "idle") {
									setCopyState("idle");
								}
							}}
							placeholder="Filter logs"
							className="h-7 text-xs"
						/>
						<span className="text-[10px] text-muted-foreground whitespace-nowrap">
							{logFilter.trim() === "" ? "All lines" : "Filtered"}
						</span>
					</div>
					{logPayload.truncated && (
						<p className="mb-2 text-[10px] text-muted-foreground">
							Showing the most recent log output.
						</p>
					)}
					<pre className="max-h-80 overflow-auto rounded bg-background p-2 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-words">
						{filteredLog}
					</pre>
				</div>
			)}

			{hasLogsResult && logPayload === null && (
				<p className="px-2.5 py-3 text-xs text-muted-foreground">
					Logs are unavailable from the API for this job. Use the GitHub link
					for full logs.
				</p>
			)}

			{Option.isSome(logsError) && (
				<p className="px-2.5 py-3 text-xs text-destructive">
					Could not fetch logs right now.
				</p>
			)}

			{!hasLogsResult && Option.isNone(logsError) && !isLogsLoading && (
				<p className="px-2.5 py-3 text-xs text-muted-foreground">
					Load live logs from GitHub on demand.
				</p>
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSteps(stepsJson: string | null): readonly Step[] {
	if (!stepsJson) return [];
	try {
		return JSON.parse(stepsJson);
	} catch {
		return [];
	}
}

function computeDuration(
	startedAt: number | null,
	completedAt: number | null,
): string | null {
	if (!startedAt || !completedAt) return null;
	const seconds = Math.floor((completedAt - startedAt) / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const remaining = seconds % 60;
	if (minutes < 60) return `${minutes}m ${remaining}s`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return `${hours}h ${remainingMinutes}m`;
}

function RunConclusionIconLarge({
	status,
	conclusion,
}: {
	status: string | null;
	conclusion: string | null;
}) {
	if (status === "in_progress" || status === "queued")
		return (
			<div className="mt-1 size-5 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin shrink-0" />
		);
	if (conclusion === "success")
		return (
			<svg
				className="mt-1 size-5 text-green-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
			</svg>
		);
	if (conclusion === "failure")
		return (
			<svg
				className="mt-1 size-5 text-red-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
			</svg>
		);
	if (conclusion === "cancelled")
		return (
			<div className="mt-1 size-5 rounded-full bg-muted-foreground/30 shrink-0" />
		);
	return (
		<div className="mt-1 size-5 rounded-full border-2 border-muted-foreground shrink-0" />
	);
}

function RunStatusBadge({
	status,
	conclusion,
}: {
	status: string | null;
	conclusion: string | null;
}) {
	if (status === "in_progress")
		return (
			<Badge className="bg-yellow-600 hover:bg-yellow-700 text-[10px]">
				In Progress
			</Badge>
		);
	if (status === "queued")
		return (
			<Badge variant="outline" className="text-[10px]">
				Queued
			</Badge>
		);
	if (conclusion === "success")
		return (
			<Badge className="bg-green-600 hover:bg-green-700 text-[10px]">
				Success
			</Badge>
		);
	if (conclusion === "failure")
		return (
			<Badge variant="destructive" className="text-[10px]">
				Failed
			</Badge>
		);
	if (conclusion === "cancelled")
		return (
			<Badge variant="secondary" className="text-[10px]">
				Cancelled
			</Badge>
		);
	return (
		<Badge variant="outline" className="text-[10px]">
			{conclusion ?? status ?? "Unknown"}
		</Badge>
	);
}

function ConclusionBadge({ conclusion }: { conclusion: string }) {
	if (conclusion === "success")
		return (
			<Badge variant="secondary" className={cn("text-[10px] text-green-600")}>
				{conclusion}
			</Badge>
		);
	if (conclusion === "failure")
		return (
			<Badge variant="destructive" className="text-[10px]">
				{conclusion}
			</Badge>
		);
	return (
		<Badge variant="outline" className="text-[10px]">
			{conclusion}
		</Badge>
	);
}

function JobConclusionIcon({
	status,
	conclusion,
}: {
	status: string;
	conclusion: string | null;
}) {
	if (status === "in_progress")
		return (
			<div className="size-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin shrink-0" />
		);
	if (conclusion === "success")
		return (
			<svg
				className="size-4 text-green-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
			</svg>
		);
	if (conclusion === "failure")
		return (
			<svg
				className="size-4 text-red-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
			</svg>
		);
	if (conclusion === "cancelled" || conclusion === "skipped")
		return (
			<div className="size-4 rounded-full bg-muted-foreground/30 shrink-0" />
		);
	return (
		<div className="size-4 rounded-full border-2 border-muted-foreground shrink-0" />
	);
}

function StepConclusionIcon({ conclusion }: { conclusion: string | null }) {
	if (conclusion === "success")
		return (
			<svg
				className="size-3 text-green-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
			</svg>
		);
	if (conclusion === "failure")
		return (
			<svg
				className="size-3 text-red-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
			</svg>
		);
	if (conclusion === "skipped")
		return (
			<div className="size-3 rounded-full bg-muted-foreground/20 shrink-0" />
		);
	return (
		<div className="size-3 rounded-full border-2 border-muted-foreground/50 shrink-0" />
	);
}

function formatRelative(timestamp: number): string {
	const diff = Math.floor((Date.now() - timestamp) / 1000);
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
