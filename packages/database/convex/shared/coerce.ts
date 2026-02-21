export const toStringOrNull = <A>(value: A): string | null =>
	typeof value === "string" ? value : null;

export const toNumberOrNull = <A>(value: A): number | null =>
	typeof value === "number" ? value : null;

export const toTrueBoolean = <A>(value: A): boolean => value === true;

export const toObjectRecord = <A>(value: A): Record<string, unknown> => {
	if (typeof value !== "object" || value === null) return {};
	return Object.fromEntries(Object.entries(value));
};

export const toOpenClosedState = (
	value: string | null | undefined,
): "open" | "closed" => (value === "open" ? "open" : "closed");
