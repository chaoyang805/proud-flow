import { jsonResponse } from "../../middleware/error";
import type { RequirementsService } from "./service";

export async function handleRequirementsRoute(
  request: Request,
  pathname: string,
  service: RequirementsService,
): Promise<Response | undefined> {
  if (pathname === "/api/requirements" && request.method === "POST") {
    return jsonResponse(await service.create(await request.json()), { status: 201 });
  }
  if (pathname === "/api/requirements" && request.method === "GET") {
    return jsonResponse({ items: await service.list() });
  }
  const match = pathname.match(/^\/api\/requirements\/(REQ-\d{6})$/);
  if (!match) return undefined;
  if (request.method === "GET") return jsonResponse(await service.get(match[1]));
  if (request.method === "PATCH")
    return jsonResponse(await service.update(match[1], await request.json()));
  return undefined;
}
