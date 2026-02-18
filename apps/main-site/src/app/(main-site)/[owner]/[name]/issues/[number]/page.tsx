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

export default function IssueDetailPage(props: {
	params: Promise<{ owner: string; name: string; number: string }>;
}) {
	const params = use(props.params);
	const { owner, name } = params;
	const issueNumber = parseInt(params.number, 10);

	const client = useProjectionQueries();
	const issueAtom = useMemo(
		() =>
			client.getIssueDetail.subscription({
				ownerLogin: owner,
				name,
				number: issueNumber,
			}),
		[client, owner, name, issueNumber],
	);
	const issueResult = useAtomValue(issueAtom);

	if (Result.isInitial(issueResult)) {
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

	const valueOption = Result.value(issueResult);
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
				<h1 className="text-2xl font-bold">Issue #{issueNumber}</h1>
				<p className="mt-2 text-muted-foreground">
					Issue not found in {owner}/{name}
				</p>
			</main>
		);
	}

	const issue = valueOption.value;

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
				<IssueStateIcon state={issue.state} />
				<div>
					<h1 className="text-2xl font-bold">{issue.title}</h1>
					<div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
						<span>#{issue.number}</span>
						<Badge
							variant={issue.state === "open" ? "default" : "secondary"}
							className={
								issue.state === "open" ? "bg-green-600 hover:bg-green-700" : ""
							}
						>
							{issue.state === "open" ? "Open" : "Closed"}
						</Badge>
						{issue.authorLogin && (
							<span className="flex items-center gap-1">
								<Avatar className="size-5">
									<AvatarImage src={issue.authorAvatarUrl ?? undefined} />
									<AvatarFallback className="text-[10px]">
										{issue.authorLogin[0]?.toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="font-medium text-foreground">
									{issue.authorLogin}
								</span>{" "}
								opened {formatRelative(issue.githubUpdatedAt)}
							</span>
						)}
						{issue.labelNames.map((label) => (
							<Badge key={label} variant="outline" className="text-xs">
								{label}
							</Badge>
						))}
					</div>
				</div>
			</div>

			{/* Body */}
			{issue.body && (
				<Card className="mt-6">
					<CardContent className="pt-6">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<Markdown remarkPlugins={[remarkGfm]}>{issue.body}</Markdown>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Comments */}
			{issue.comments.length > 0 && (
				<div className="mt-8">
					<h2 className="text-lg font-semibold mb-4">
						{issue.comments.length} Comment
						{issue.comments.length !== 1 ? "s" : ""}
					</h2>
					<div className="space-y-4">
						{issue.comments.map((comment) => (
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

			{issue.comments.length === 0 && (
				<p className="mt-8 text-sm text-muted-foreground">No comments yet.</p>
			)}
		</main>
	);
}

function IssueStateIcon({ state }: { state: "open" | "closed" }) {
	if (state === "open") {
		return (
			<svg
				className="mt-1.5 size-5 text-green-600 shrink-0"
				viewBox="0 0 16 16"
				fill="currentColor"
			>
				<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
				<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
			</svg>
		);
	}
	return (
		<svg
			className="mt-1.5 size-5 text-purple-600 shrink-0"
			viewBox="0 0 16 16"
			fill="currentColor"
		>
			<path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z" />
			<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z" />
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
