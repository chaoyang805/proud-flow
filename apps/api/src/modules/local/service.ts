import {
  localBootstrapRequestSchema,
  rotateTokenRequestSchema,
  revokeTokenRequestSchema,
  type LocalBootstrapResponse,
  type RotateTokenResponse,
} from "@proud-flow/api-contract";
import type { TokenType } from "@proud-flow/domain";
import type { ApiEnv } from "../../env.js";
import { requireBootstrapToken } from "../../middleware/auth.js";
import { hashToken } from "../auth/token-service.js";
import type { InMemoryRequirementRepository } from "../requirements/repository.js";

type ManagedTokenType = Extract<TokenType, "skill" | "dispatcher" | "local">;

export class LocalApiService {
  constructor(private readonly repository: InMemoryRequirementRepository) {}

  async bootstrap(input: unknown, env: ApiEnv): Promise<LocalBootstrapResponse> {
    const request = localBootstrapRequestSchema.parse(input);
    await requireBootstrapToken(request.bootstrapToken, env);
    return {
      tokens: {
        skill: await this.createAndStoreToken("skill", request.machineName, env),
        dispatcher: await this.createAndStoreToken(
          "dispatcher",
          request.machineName,
          env,
        ),
        local: await this.createAndStoreToken("local", request.machineName, env),
      },
    };
  }

  async rotate(input: unknown, env: ApiEnv): Promise<RotateTokenResponse> {
    const request = rotateTokenRequestSchema.parse(input);
    this.repository.revokeApiTokens(request.tokenType);
    return {
      token: await this.createAndStoreToken(request.tokenType, undefined, env),
    };
  }

  revoke(input: unknown): Record<string, never> {
    const request = revokeTokenRequestSchema.parse(input);
    this.repository.revokeApiTokens(request.tokenType);
    return {};
  }

  private async createAndStoreToken(
    tokenType: ManagedTokenType,
    machineName: string | undefined,
    env: ApiEnv,
  ): Promise<string> {
    const token = createPlaintextToken(tokenType);
    this.repository.createApiToken({
      tokenType,
      machineName,
      tokenHash: await hashToken(token, env.TOKEN_HASH_SECRET),
    });
    return token;
  }
}

function createPlaintextToken(tokenType: ManagedTokenType): string {
  return `pf_${tokenType}_${randomTokenSuffix()}`;
}

function randomTokenSuffix(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
