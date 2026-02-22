export type RankedResult<Item> = {
	readonly id: string;
	readonly item: Item;
};

export function mergeRankedResults<Item>(
	previous: ReadonlyArray<RankedResult<Item>>,
	next: ReadonlyArray<RankedResult<Item>>,
	focusedId: string | null,
): ReadonlyArray<RankedResult<Item>> {
	if (next.length === 0) return [];
	if (previous.length === 0) return next;

	const previousById = new Map<string, RankedResult<Item>>();
	for (const entry of previous) {
		previousById.set(entry.id, entry);
	}

	const nextById = new Map<string, RankedResult<Item>>();
	const nextIdSet = new Set<string>();
	for (const entry of next) {
		nextById.set(entry.id, entry);
		nextIdSet.add(entry.id);
	}

	const focusedIndex =
		focusedId === null
			? -1
			: previous.findIndex((entry) => entry.id === focusedId);

	let targetLength = next.length;
	if (focusedIndex >= 0) {
		targetLength = Math.max(targetLength, focusedIndex + 1);
	}

	const slots: Array<string | null> = [];
	for (let index = 0; index < targetLength; index += 1) {
		slots.push(null);
	}
	const preservedIds = new Set<string>();

	for (const [index, previousEntry] of previous.entries()) {
		if (index >= slots.length) continue;
		const shouldPreserve =
			nextIdSet.has(previousEntry.id) || previousEntry.id === focusedId;
		if (!shouldPreserve) continue;
		slots[index] = previousEntry.id;
		preservedIds.add(previousEntry.id);
	}

	const incomingIds: Array<string> = [];
	for (const entry of next) {
		if (preservedIds.has(entry.id)) continue;
		incomingIds.push(entry.id);
	}

	let incomingIndex = 0;
	for (const [slotIndex, slotValue] of slots.entries()) {
		if (slotValue !== null) continue;
		const incomingId = incomingIds[incomingIndex];
		if (incomingId === undefined) continue;
		slots[slotIndex] = incomingId;
		incomingIndex += 1;
	}

	const merged: Array<RankedResult<Item>> = [];
	const seenIds = new Set<string>();
	for (const slotId of slots) {
		if (slotId === null || seenIds.has(slotId)) continue;
		const item = nextById.get(slotId) ?? previousById.get(slotId);
		if (item === undefined) continue;
		seenIds.add(slotId);
		merged.push(item);
	}

	return merged;
}
