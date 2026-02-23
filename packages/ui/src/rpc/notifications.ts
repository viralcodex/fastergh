"use client";

import { api } from "@packages/database/convex/_generated/api";
import type { NotificationsModule } from "@packages/database/convex/rpc/notifications";
import { createRpcModuleClientContext } from "./client-context";

export const {
	RpcClientProvider: NotificationsProvider,
	useRpcClient: useNotifications,
} = createRpcModuleClientContext<NotificationsModule>(api.rpc.notifications);
