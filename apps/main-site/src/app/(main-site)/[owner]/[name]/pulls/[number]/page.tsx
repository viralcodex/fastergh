"use client";

import { Result, useAtomValue } from "@effect-atom/atom-react";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@packages/ui/components/avatar";
import { Badge } from "@packages/ui/components/badge";
import { Card, CardContent, CardHeader } from "@packages/ui/components/card";
import { Link } from "@packages/ui/components/link";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useProjectionQueries } from "@packages/ui/rpc/projection-queries";
import { Option } from "effect";
import { use, useMemo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

function formatDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function PullRequestDetailPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const params = use(props.params);
	const { owner, name } = params;
	const prNumber = parseInt(params.number, 10);

	const client = useProjectionQueries();
	const prAtom = useMemo(
		() =>
			client.getPullRequestDetail.subscription({
				ownerLogin: owner,
				name,
				number: prNumber,
			}),
		[client, owner, name, prNumber],
	);
	const prResult = useAtomValue(prAtom);

	if (Result.isInitial(prResult)) {
		return (
			<main className="mx-auto max-w-4xl px-4 py-8">
				<div className="mb-6">
					<Link
						href={`/${owner}/${name}`}
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						&larr; {owner}/{name}
					</Link>
				</div>
				<DetailSkeleton />
			</main>
		);
	}

	const valueOption = Result.value(prResult);
	if (Option.isNone(valueOption) || valueOption.value === null) {
		return (
			<main className="mx-auto max-w-4xl px-4 py-8">
				<div className="mb-6">
					<Link
						href={`/${owner}/${name}`}
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						&larr; {owner}/{name}
					</Link>
				</div>
				<h1 className="text-2xl font-bold">Pull Request #{prNumber}</h1>
				<p className="mt-2 text-muted-foreground">
					Pull request not found in {owner}/{name}
				</p>
			</main>
		);
	}

	const pr = valueOption.value;

	return (
		<main className="mx-auto max-w-4xl px-4 py-8">
			<div className="mb-6">
				<Link
					href={`/${owner}/${name}`}
					className="text-sm text-muted-foreground hover:text-foreground"
				>
					&larr; {owner}/{name}
				</Link>
			</div>

			{/* Header */}
			<div className="flex items-start gap-3">
				<PrStateIcon state={pr.state} draft={pr.draft} />
				<div className="min-w-0">
					<h1 className="text-2xl font-bold">{pr.title}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<span>#{pr.number}</span>
						<PrStateBadge
							state={pr.state}
							draft={pr.draft}
							mergedAt={pr.mergedAt}
						/>
						{pr.authorLogin && (
							<span className="flex items-center gap-1">
								<Avatar className="size-5">
									<AvatarImage src={pr.authorAvatarUrl ?? undefined} />
									<AvatarFallback className="text-[10px]">
										{pr.authorLogin[0]?.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="font-medium text-foreground">
									{pr.authorLogin}
								</span>
							</span>
						)}
						<span>
							wants to merge{" "}
							<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
								{pr.headRefName}
							</code>
							{" into "}
							<code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
								{pr.baseRefName}
							</code>
						</span>
					</div>
				</div>
			</div>

			{/* Metadata bar */}
			<div className="mt-4 flex flex-wrap gap-2">
				{pr.mergeableState && <MergeableStateBadge state={pr.mergeableState} />}
				<Badge variant="outline" className="text-xs font-mono">
					{pr.headSha.slice(0, 7)}
				</Badge>
				<span className="text-sm text-muted-foreground">
					Updated {formatRelative(pr.githubUpdatedAt)}
				</span>
			</div>

			{/* Body */}
			{pr.body && (
				<Card className="mt-6">
					<CardContent className="pt-6">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<Markdown remarkPlugins={[remarkGfm]}>{pr.body}</Markdown>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Check runs */}
			{pr.checkRuns.length > 0 && (
				<div className="mt-8">
					<h2 className="text-lg font-semibold mb-4">
						Checks ({pr.checkRuns.length})
					</h2>
					<Card>
						<CardContent className="pt-4">
							<div className="divide-y">
								{pr.checkRuns.map((check) => (
									<div
										key={check.name}
										className="flex items-center justify-between py-2"
									>
										<div className="flex items-center gap-2">
											<CheckIcon
												status={check.status}
												conclusion={check.conclusion}
											/>
											<span className="text-sm font-medium">{check.name}</span>
										</div>
										{check.conclusion && (
											<Badge
												variant={
													check.conclusion === "success"
														? "secondary"
														: check.conclusion === "failure"
															? "destructive"
															: "outline"
												}
												className={
													check.conclusion === "success" ? "text-green-600" : ""
												}
											>
												{check.conclusion}
											</Badge>
										)}
										{!check.conclusion && check.status === "in_progress" && (
											<Badge variant="outline">In progress</Badge>
										)}
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Reviews */}
			{pr.reviews.length > 0 && (
				<div className="mt-8">
					<h2 className="text-lg font-semibold mb-4">
						Reviews ({pr.reviews.length})
					</h2>
					<div className="space-y-3">
						{pr.reviews.map((review) => (
							<div
								key={review.githubReviewId}
								className="flex items-center gap-3 rounded-lg border px-4 py-3"
							>
								{review.authorLogin && (
									<Avatar className="size-6">
										<AvatarImage src={review.authorAvatarUrl ?? undefined} />
										<AvatarFallback className="text-[10px]">
											{review.authorLogin[0]?.toUpperCase()}
										</AvatarFallback>
									</Avatar>
								)}
								<span className="text-sm font-medium">
									{review.authorLogin ?? "Unknown"}
								</span>
								<ReviewStateBadge state={review.state} />
								{review.submittedAt && (
									<span className="text-xs text-muted-foreground">
										{formatDate(review.submittedAt)}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Comments */}
			{pr.comments.length > 0 && (
				<div className="mt-8">
					<h2 className="text-lg font-semibold mb-4">
						{pr.comments.length} Comment
						{pr.comments.length !== 1 ? "s" : ""}
					</h2>
					<div className="space-y-4">
						{pr.comments.map((comment) => (
							<Card key={comment.githubCommentId}>
								<CardHeader className="pb-2">
									<div className="flex items-center gap-2 text-sm">
										{comment.authorLogin && (
											<span className="flex items-center gap-1.5">
												<Avatar className="size-5">
													<AvatarImage
														src={comment.authorAvatarUrl ?? undefined}
													/>
													<AvatarFallback className="text-[10px]">
														{comment.authorLogin[0]?.toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<span className="font-medium">
													{comment.authorLogin}
												</span>
											</span>
										)}
										<span className="text-muted-foreground">
											{formatDate(comment.createdAt)}
										</span>
									</div>
								</CardHeader>
								<CardContent>
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<Markdown remarkPlugins={[remarkGfm]}>
											{comment.body}
										</Markdown>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{pr.comments.length === 0 && pr.reviews.length === 0 && (
				<p className="mt-8 text-sm text-muted-foreground">
					No comments or reviews yet.
				</p>
			)}
		</main>
	);
}

// --- Helper components ---

function PrStateIcon({
	state,
	draft,
}: {
	state: "open" | "closed";
	draft: boolean;
}) {
	if (draft) {
		return (
			<svg
				className="mt-1.5 size-5 text-muted-foreground shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Zm0-3a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
			</svg>
		);
	}
	if (state === "open") {
		return (
			<svg
				className="mt-1.5 size-5 text-green-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
			</svg>
		);
	}
	return (
		<svg
			className="mt-1.5 size-5 text-purple-600 shrink-0"
			viewBox="0 0 16 16"
			fill="currentColor"
		>
			<path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8-9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM4.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
		</svg>
	);
}

function PrStateBadge({
	state,
	draft,
	mergedAt,
}: {
	state: "open" | "closed";
	draft: boolean;
	mergedAt: number | null;
}) {
	if (mergedAt !== null) {
		return <Badge className="bg-purple-600 hover:bg-purple-700">Merged</Badge>;
	}
	if (draft) {
		return <Badge variant="outline">Draft</Badge>;
	}
	if (state === "open") {
		return <Badge className="bg-green-600 hover:bg-green-700">Open</Badge>;
	}
	return <Badge variant="secondary">Closed</Badge>;
}

function MergeableStateBadge({ state }: { state: string }) {
	switch (state) {
		case "clean":
			return (
				<Badge variant="secondary" className="text-green-600 text-xs">
					Ready to merge
				</Badge>
			);
		case "dirty":
			return (
				<Badge variant="destructive" className="text-xs">
					Has conflicts
				</Badge>
			);
		case "blocked":
			return (
				<Badge variant="outline" className="text-xs">
					Blocked
				</Badge>
			);
		case "unstable":
			return (
				<Badge variant="outline" className="text-xs text-yellow-600">
					Unstable
				</Badge>
			);
		default:
			return (
				<Badge variant="outline" className="text-xs">
					{state}
				</Badge>
			);
	}
}

function ReviewStateBadge({ state }: { state: string }) {
	switch (state) {
		case "APPROVED":
			return (
				<Badge variant="secondary" className="text-green-600 text-xs">
					Approved
				</Badge>
			);
		case "CHANGES_REQUESTED":
			return (
				<Badge variant="destructive" className="text-xs">
					Changes requested
				</Badge>
			);
		case "COMMENTED":
			return (
				<Badge variant="outline" className="text-xs">
					Commented
				</Badge>
			);
		case "DISMISSED":
			return (
				<Badge variant="outline" className="text-xs text-muted-foreground">
					Dismissed
				</Badge>
			);
		case "PENDING":
			return (
				<Badge variant="outline" className="text-xs">
					Pending
				</Badge>
			);
		default:
			return (
				<Badge variant="outline" className="text-xs">
					{state}
				</Badge>
			);
	}
}

function CheckIcon({
	status,
	conclusion,
}: {
	status: string;
	conclusion: string | null;
}) {
	if (conclusion === "success") {
		return (
			<svg
				className="size-4 text-green-600"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
			</svg>
		);
	}
	if (conclusion === "failure") {
		return (
			<svg
				className="size-4 text-red-600"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
			</svg>
		);
	}
	if (status === "in_progress") {
		return (
			<svg
				className="size-4 text-yellow-500 animate-spin"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path
					d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"
					opacity=".3"
				/>
				<path d="M8 0a8 8 0 0 1 8 8h-1.5A6.5 6.5 0 0 0 8 1.5V0Z" />
			</svg>
		);
	}
	return (
		<svg
			className="size-4 text-muted-foreground"
			viewBox="0 0 16 16"
			fill="currentColor"
		>
			<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
		</svg>
	);
}

function DetailSkeleton() {
	return (
		<div>
			<Skeleton className="h-8 w-3/4" />
			<Skeleton className="mt-3 h-5 w-1/2" />
			<Skeleton className="mt-6 h-40 w-full" />
			<Skeleton className="mt-8 h-6 w-32" />
			<div className="mt-4 space-y-4">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-24 w-full" />
			</div>
		</div>
	);
}
