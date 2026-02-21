export const parseIsoToMsOrNull = <A>(value: A): number | null => {
	if (typeof value !== "string") return null;
	const milliseconds = new Date(value).getTime();
	return Number.isNaN(milliseconds) ? null : milliseconds;
};

export const parseIsoToMsOrNow = <A>(value: A): number => {
	const milliseconds = parseIsoToMsOrNull(value);
	return milliseconds ?? Date.now();
};
