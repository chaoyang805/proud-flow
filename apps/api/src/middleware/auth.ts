import { parseHashList, type ApiEnv } from "../env.js";
import { ApiError } from "./error.js";
import {
  readBearerToken,
  verifyTokenHash,
} from "../modules/auth/token-service.js";

export async function requireUserToken(
  request: Request,
  env: ApiEnv,
): Promise<void> {
  const hashes = parseHashList(env.USER_TOKEN_HASHES);
  if (hashes.length === 0) return;
  const token = readBearerToken(request.headers);
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token");
  const verified = await verifyTokenHash(token, hashes, env.TOKEN_HASH_SECRET);
  if (!verified) throw new ApiError(403, "FORBIDDEN", "Invalid bearer token");
}
