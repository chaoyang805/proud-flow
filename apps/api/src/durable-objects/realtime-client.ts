import type { RealtimeEvent } from "@proud-flow/domain";
import { createDoRequest, DO_PATH_BROADCAST } from "./do-request";
import type { DoStub } from "./fetch-do";
import { fetchDo } from "./fetch-do";

export async function broadcastRealtimeViaDo(
  stub: DoStub,
  event: RealtimeEvent,
): Promise<void> {
  const response = await fetchDo(
    stub,
    createDoRequest(DO_PATH_BROADCAST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }),
  );
  if (!response.ok) {
    console.error(`[realtime-do] broadcast failed: ${response.status}`);
  }
}
