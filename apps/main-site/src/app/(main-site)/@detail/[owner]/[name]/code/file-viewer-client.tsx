"use client";

import { Result, useAtom } from "@effect-atom/atom-react";
import { useCodeBrowse } from "@packages/ui/rpc/code-browse";
import { Option } from "effect";
import { Code2, File, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

function errorTag(err: unknown): string | null {
	if (typeof err !== "object" || err === null || !("_tag" in err)) return null;
	const val = err._tag;
	return typeof val === "string" ? val : null;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileContentView({
	content,
	path,
	size,
}: {
	content: string | null;
	path: string;
	size: number;
}) {
	const fileName = path.split("/").pop() ?? path;
	const lines = content?.split("\n") ?? [];

	if (content === null) {
		return (
			<div className="flex h-full flex-col">
				<div className="flex items-center gap-2 border-b px-3 py-2">
					<File className="size-3 text-muted-foreground" />
					<span className="text-xs font-medium truncate">{fileName}</span>
					<span className="ml-auto text-[10px] text-muted-foreground">
						{formatBytes(size)}
					</span>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<p className="text-xs text-muted-foreground">
						Binary file — cannot display
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<File className="size-3 text-muted-foreground" />
				<span className="text-xs font-medium truncate">{path}</span>
				<span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
					{lines.length} lines · {formatBytes(size)}
				</span>
			</div>
			<div className="flex-1 overflow-auto">
				<table className="w-full border-collapse text-xs font-mono">
					<tbody>
						{lines.map((line, i) => (
							<tr key={i} className="hover:bg-muted/40 transition-colors">
								<td className="select-none px-3 py-0 text-right align-top text-muted-foreground/50 w-[1%] whitespace-nowrap">
									{i + 1}
								</td>
								<td className="px-3 py-0 whitespace-pre">{line}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function FileViewerClient({
	owner,
	name,
	path,
}: {
	owner: string;
	name: string;
	path: string | null;
}) {
	const client = useCodeBrowse();
	const [fileResult, fetchFile] = useAtom(client.getFileContent.call);
	const lastFetchedPath = useRef<string | null>(null);

	useEffect(() => {
		if (path !== null && path !== lastFetchedPath.current) {
			lastFetchedPath.current = path;
			fetchFile({ ownerLogin: owner, name, path, ref: "HEAD" });
		}
	}, [fetchFile, owner, name, path]);

	// No file selected
	if (path === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="text-center">
					<Code2 className="mx-auto size-10 text-muted-foreground/30" />
					<p className="mt-3 text-sm text-muted-foreground">
						Select a file from the tree to view its contents
					</p>
				</div>
			</div>
		);
	}

	const isLoading = Result.isWaiting(fileResult);
	const isInitial = Result.isInitial(fileResult);
	const valueOption = Result.value(fileResult);
	const errorOption = Result.error(fileResult);

	if (isInitial || (isLoading && Option.isNone(valueOption))) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-xs">Loading file...</span>
				</div>
			</div>
		);
	}

	if (Option.isSome(errorOption) && Option.isNone(valueOption)) {
		const tag = errorTag(errorOption.value);
		const message =
			tag === "NotAuthenticated"
				? "Sign in to browse code"
				: tag === "RepoNotFound"
					? "Repository not found"
					: "Failed to load file";

		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-xs text-muted-foreground">{message}</p>
			</div>
		);
	}

	if (Option.isNone(valueOption)) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-xs text-muted-foreground">File not found</p>
			</div>
		);
	}

	const fileData = valueOption.value;

	// null response means file not found at the API level
	if (fileData === null) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-xs text-muted-foreground">File not found</p>
			</div>
		);
	}

	return (
		<FileContentView
			content={fileData.content}
			path={fileData.path}
			size={fileData.size}
		/>
	);
}
