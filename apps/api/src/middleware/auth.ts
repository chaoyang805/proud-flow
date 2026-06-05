import { parseHashList, type ApiEnv } from "../env";
import { ApiError } from "./error";
import {
  readBearerToken,
  verifyTokenHash,
} from "../modules/auth/token-service";
import type { InMemoryRequirementRepository } from "../modules/requirements/repository";

export async function requireUserToken(
  request: Request,
  env: ApiEnv,
): Promise<void> {
  const hashes = parseHashList(env.USER_TOKEN_HASHES);
  const token = readBearerToken(request.headers);
  if (hashes.length === 0) {
    if (token?.startsWith("pf_skill_") || token?.startsWith("pf_local_")) {
      throw new ApiError(403, "FORBIDDEN", "Token cannot access user API");
    }
    if (token?.startsWith("pf_dispatcher_")) {
      throw new ApiError(403, "FORBIDDEN", "Token cannot access user API");
    }
    return;
  }
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token");
  const verified = await verifyTokenHash(token, hashes, env.TOKEN_HASH_SECRET);
  if (!verified) throw new ApiError(403, "FORBIDDEN", "Invalid bearer token");
}

export async function requireBootstrapToken(
  token: string,
  env: ApiEnv,
): Promise<void> {
  const hashes = parseHashList(env.BOOTSTRAP_TOKEN_HASHES);
  if (hashes.length === 0) return;
  const verified = await verifyTokenHash(token, hashes, env.TOKEN_HASH_SECRET);
  if (!verified) throw new ApiError(403, "FORBIDDEN", "Invalid bootstrap token");
}

export async function requireSkillToken(
  request: Request,
  env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<void> {
  await requireTypedToken(request, env, [
    ...parseHashList(env.SKILL_TOKEN_HASHES),
    ...repository.listActiveApiTokenHashes("skill"),
  ]);
}

export async function requireLocalToken(
  request: Request,
  env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<void> {
  await requireTypedToken(request, env, [
    ...parseHashList(env.LOCAL_TOKEN_HASHES),
    ...repository.listActiveApiTokenHashes("local"),
  ]);
}

export async function requireDispatcherToken(
  request: Request,
  env: ApiEnv,
  repository: InMemoryRequirementRepository,
): Promise<void> {
  await requireTypedToken(request, env, [
    ...parseHashList(env.DISPATCHER_TOKEN_HASHES),
    ...repository.listActiveApiTokenHashes("dispatcher"),
  ]);
}

async function requireTypedToken(
  request: Request,
  env: ApiEnv,
  hashes: readonly string[],
): Promise<void> {
  const token = readBearerToken(request.headers);
  if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token");
  if (hashes.length === 0) {
    throw new ApiError(403, "FORBIDDEN", "Invalid bearer token");
  }
  const verified = await verifyTokenHash(token, hashes, env.TOKEN_HASH_SECRET);
  if (!verified) throw new ApiError(403, "FORBIDDEN", "Invalid bearer token");
}
