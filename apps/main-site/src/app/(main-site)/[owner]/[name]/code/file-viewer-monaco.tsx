"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Monaco = dynamic(() => import("@monaco-editor/react"), {
	ssr: false,
	loading: () => <div className="h-full w-full" />,
});

const languageByExtension: Record<string, string> = {
	bash: "shell",
	c: "c",
	cpp: "cpp",
	cs: "csharp",
	css: "css",
	go: "go",
	html: "html",
	java: "java",
	js: "javascript",
	json: "json",
	jsx: "javascript",
	md: "markdown",
	mdx: "markdown",
	php: "php",
	py: "python",
	rb: "ruby",
	rs: "rust",
	sh: "shell",
	sql: "sql",
	svelte: "html",
	tsx: "typescript",
	ts: "typescript",
	vue: "html",
	xml: "xml",
	yaml: "yaml",
	yml: "yaml",
};

function inferMonacoLanguage(path: string): string {
	const extension = path.split(".").pop()?.toLowerCase();
	if (!extension) return "plaintext";
	return languageByExtension[extension] ?? "plaintext";
}

export function FileViewerMonaco({
	path,
	content,
}: {
	path: string;
	content: string;
}) {
	const { resolvedTheme } = useTheme();

	return (
		<div className="h-full min-h-0">
			<Monaco
				height="100%"
				language={inferMonacoLanguage(path)}
				value={content}
				theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
				options={{
					readOnly: true,
					minimap: { enabled: false },
					automaticLayout: true,
					scrollBeyondLastLine: false,
					lineNumbers: "on",
					wordWrap: "off",
					renderValidationDecorations: "off",
					padding: { top: 12 },
				}}
			/>
		</div>
	);
}
