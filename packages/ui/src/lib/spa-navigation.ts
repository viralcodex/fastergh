const getBrowserWindow = (): Window | null =>
	typeof window === "undefined" ? null : window;

const QUICKHUB_NAVIGATE_EVENT = "quickhub:navigate";
const QUICKHUB_PREFETCH_EVENT = "quickhub:prefetch";

export const isQuickHubSpaNavigationEnabled = (): boolean => {
	const currentWindow = getBrowserWindow();
	if (currentWindow === null) {
		return false;
	}
	return Reflect.get(currentWindow, "__quickhubSpa") === true;
};

export const notifyQuickHubNavigation = () => {
	const currentWindow = getBrowserWindow();
	if (currentWindow === null) {
		return;
	}

	currentWindow.dispatchEvent(new Event("quickhub:navigation"));
};

export const navigateQuickHubSpa = (href: string) => {
	const currentWindow = getBrowserWindow();
	if (currentWindow === null) {
		return;
	}

	if (!href.startsWith("/")) {
		currentWindow.location.assign(href);
		return;
	}

	currentWindow.dispatchEvent(
		new CustomEvent(QUICKHUB_NAVIGATE_EVENT, {
			detail: { href },
		}),
	);
};

export const quickHubNavigateEvent = QUICKHUB_NAVIGATE_EVENT;

export const prefetchQuickHubSpa = (href: string) => {
	const currentWindow = getBrowserWindow();
	if (currentWindow === null) {
		return;
	}

	if (!href.startsWith("/")) {
		return;
	}

	currentWindow.dispatchEvent(
		new CustomEvent(QUICKHUB_PREFETCH_EVENT, {
			detail: { href },
		}),
	);
};

export const quickHubPrefetchEvent = QUICKHUB_PREFETCH_EVENT;
