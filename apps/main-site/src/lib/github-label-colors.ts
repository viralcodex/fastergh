const githubLabelColorClassByName: Record<string, string> = {
	bug: "border-[#d73a4a]/45 bg-[#d73a4a]/20 text-[#ff9ca8]",
	documentation: "border-[#0075ca]/45 bg-[#0075ca]/20 text-[#78c4ff]",
	duplicate: "border-[#cfd3d7]/45 bg-[#cfd3d7]/18 text-[#e8edf2]",
	enhancement: "border-[#a2eeef]/45 bg-[#a2eeef]/20 text-[#bdf7f8]",
	"good first issue": "border-[#7057ff]/45 bg-[#7057ff]/20 text-[#b0a3ff]",
	"help wanted": "border-[#008672]/45 bg-[#008672]/20 text-[#67d8c6]",
	invalid: "border-[#e4e669]/45 bg-[#e4e669]/20 text-[#f2f39d]",
	question: "border-[#d876e3]/45 bg-[#d876e3]/20 text-[#f0b0f7]",
	wontfix: "border-white/45 bg-white/15 text-white",
	core: "border-[#c2e0c6]/45 bg-[#c2e0c6]/20 text-[#b1d9a5]",
};

export function getGithubLabelColorClass(
	labelName: string,
): string | undefined {
	return githubLabelColorClassByName[labelName.toLowerCase()];
}
