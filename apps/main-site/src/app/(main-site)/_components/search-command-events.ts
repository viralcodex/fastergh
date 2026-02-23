export const OPEN_SEARCH_COMMAND_EVENT = "fastergh:open-search-command";

export function triggerOpenSearchCommand() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(OPEN_SEARCH_COMMAND_EVENT));
}
