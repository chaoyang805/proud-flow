import { jsonResponse } from "../../middleware/error";
import type { ArtifactsService } from "./service";

export async function handleArtifactsRoute(
  request: Request,
  pathname: string,
  service: ArtifactsService,
): Promise<Response | undefined> {
  const collectionMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/artifacts$/,
  );
  if (collectionMatch && request.method === "GET") {
    return jsonResponse({ items: service.list(collectionMatch[1]) });
  }
  if (collectionMatch && request.method === "POST") {
    return jsonResponse(
      service.create(collectionMatch[1], await request.json()),
      { status: 201 },
    );
  }
  const uploadMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/artifacts\/upload$/,
  );
  if (uploadMatch && request.method === "POST") {
    return jsonResponse(
      await service.upload(uploadMatch[1], await request.json()),
      { status: 201 },
    );
  }
  const archiveMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/archive$/,
  );
  if (archiveMatch && request.method === "POST") {
    service.archive(archiveMatch[1]);
    return jsonResponse({ archived: true });
  }
  return undefined;
}
