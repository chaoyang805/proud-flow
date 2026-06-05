import type { ApiEnv } from "../../env";
import { jsonResponse } from "../../middleware/error";
import type { InMemoryRequirementRepository } from "../requirements/repository";

export async function handleRealtimeRoute(
  request: Request,
  pathname: string,
  _env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<Response | undefined> {
  if (pathname === "/api/realtime/events" && request.method === "GET") {
    return jsonResponse({ items: repository.listRealtimeEvents() });
  }
  return undefined;
}
