"use client";

import { api } from "@packages/database/convex/_generated/api";
import type { BillingModule } from "@packages/database/convex/rpc/billing";
import { createRpcModuleClientContext } from "./client-context";

export const { RpcClientProvider: BillingProvider, useRpcClient: useBilling } =
	createRpcModuleClientContext<BillingModule>(api.rpc.billing);
