import type { RealtimeEvent } from "@proud-flow/domain";
import { broadcastRealtimeViaDo } from "../../durable-objects/realtime-client";
import { getRealtimeStub, hasDoBindings } from "../../durable-objects/stubs";
import type { ApiEnv } from "../../env";
import type { RealtimeHub } from "./hub";

export async function broadcastRealtimeEvent(
  env: ApiEnv,
  hub: RealtimeHub | undefined,
  event: RealtimeEvent,
): Promise<void> {
  if (hasDoBindings(env)) {
    await broadcastRealtimeViaDo(getRealtimeStub(env), event);
    return;
  }
  hub?.broadcast(event);
}
