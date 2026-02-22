"use client";

import { KeyboardShortcutsDialog } from "@packages/ui/components/keyboard-shortcuts-dialog";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@packages/ui/components/resizable";
import { useHotkey } from "@tanstack/react-hotkeys";
import {
	type ComponentRef,
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
} from "react";
import { SearchCommand } from "./search-command";

type SidebarPanelRef = ComponentRef<typeof ResizablePanel>;

// ---------------------------------------------------------------------------
// Hub sidebar context — allows child components to toggle the app sidebar
// ---------------------------------------------------------------------------

type HubSidebarContextValue = {
	toggleSidebar: () => void;
};

const HubSidebarContext = createContext<HubSidebarContextValue>({
	toggleSidebar: () => {},
});

export function useHubSidebar() {
	return useContext(HubSidebarContext);
}

export function HubShell({
	sidebar,
	detail,
}: {
	sidebar: ReactNode;
	detail: ReactNode;
}) {
	const sidebarPanelRef = useRef<SidebarPanelRef>(null);

	const toggleSidebar = useCallback(() => {
		const panel = sidebarPanelRef.current;
		if (panel === null) return;
		if (panel.isCollapsed()) {
			panel.expand();
		} else {
			panel.collapse();
		}
	}, []);

	useHotkey("[", (event) => {
		event.preventDefault();
		toggleSidebar();
	});

	const contextValue = useMemo<HubSidebarContextValue>(
		() => ({ toggleSidebar }),
		[toggleSidebar],
	);

	return (
		<HubSidebarContext.Provider value={contextValue}>
			<div className="h-dvh w-full bg-background">
				{/* Desktop: two-panel resizable */}
				<div className="hidden md:block h-full">
					<ResizablePanelGroup direction="horizontal" className="h-full">
						{/* Panel 1: Sidebar (repos or list) */}
						<ResizablePanel
							ref={sidebarPanelRef}
							defaultSize={18}
							minSize={11}
							maxSize={28}
							collapsible
							collapsedSize={0}
							className="border-r border-border/60"
						>
							{sidebar}
						</ResizablePanel>

						<ResizableHandle />

						{/* Panel 2: Detail/Content */}
						<ResizablePanel defaultSize={82} minSize={60} className="min-w-0">
							{detail}
						</ResizablePanel>
					</ResizablePanelGroup>
				</div>

				{/* Mobile: same shell, stacked panels */}
				<div className="md:hidden h-full">
					<div className="grid h-full grid-rows-[minmax(16rem,40dvh)_minmax(0,1fr)]">
						<div className="min-h-0 border-b border-border/60">{sidebar}</div>
						<div className="min-h-0">{detail}</div>
					</div>
				</div>

				<SearchCommand />
				<KeyboardShortcutsDialog />
			</div>
		</HubSidebarContext.Provider>
	);
}
