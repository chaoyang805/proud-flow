import { jsonResponse } from "../../middleware/error";
import type { ReviewsService } from "./service";

export async function handleReviewsRoute(
  request: Request,
  pathname: string,
  service: ReviewsService,
): Promise<Response | undefined> {
  let approveMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/reviews\/approve$/,
  );
  if (!approveMatch) {
    approveMatch = pathname.match(/^\/api\/reviews\/(REQ-\d{6})\/approve$/);
  }
  if (approveMatch && request.method === "POST") {
    return jsonResponse({ requirement: await service.approve(approveMatch[1]) });
  }
  let rollbackMatch = pathname.match(
    /^\/api\/requirements\/(REQ-\d{6})\/reviews\/rollback$/,
  );
  if (!rollbackMatch) {
    rollbackMatch = pathname.match(/^\/api\/reviews\/(REQ-\d{6})\/rollback$/);
  }
  if (rollbackMatch && request.method === "POST") {
    return jsonResponse({
      requirement: await service.rollback(rollbackMatch[1], await request.json()),
    });
  }
  return undefined;
}
