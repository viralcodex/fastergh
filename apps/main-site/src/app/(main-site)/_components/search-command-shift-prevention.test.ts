import { describe, expect, it } from "vitest";
import { mergeRankedResults } from "./search-command-shift-prevention";

function makeRanked(ids: ReadonlyArray<string>) {
	return ids.map((id) => ({ id, item: id }));
}

describe("mergeRankedResults", () => {
	it("keeps existing matches in the same positions", () => {
		const previous = makeRanked(["a", "b", "c", "d"]);
		const next = makeRanked(["c", "b", "e", "a"]);

		const merged = mergeRankedResults(previous, next, null).map(
			(entry) => entry.id,
		);

		expect(merged).toEqual(["a", "b", "c", "e"]);
	});

	it("pins the focused result even when absent in new results", () => {
		const previous = makeRanked(["pr-12", "pr-42", "pr-7"]);
		const next = makeRanked(["pr-3", "pr-7", "pr-8"]);

		const merged = mergeRankedResults(previous, next, "pr-42").map(
			(entry) => entry.id,
		);

		expect(merged).toEqual(["pr-3", "pr-42", "pr-7"]);
	});

	it("falls back to next-ranked results for removed entries", () => {
		const previous = makeRanked(["a", "b", "c", "d"]);
		const next = makeRanked(["x", "y", "b", "z"]);

		const merged = mergeRankedResults(previous, next, null).map(
			(entry) => entry.id,
		);

		expect(merged).toEqual(["x", "b", "y", "z"]);
	});

	it("returns no results when next is empty", () => {
		const previous = makeRanked(["a", "b", "c"]);
		const merged = mergeRankedResults(previous, [], "b");

		expect(merged).toEqual([]);
	});
});
