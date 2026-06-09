import { tokenTypes, type TokenType } from "@proud-flow/domain";
import {
  enumSchema,
  objectSchema,
  stringSchema,
  type Schema,
} from "./schema";

export interface LocalBootstrapRequest {
  bootstrapToken: string;
  machineName: string;
}

export interface LocalBootstrapResponse {
  tokens: {
    skill: string;
    dispatcher: string;
    local: string;
  };
}

export interface RotateTokenRequest {
  tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">;
}

export interface RotateTokenResponse {
  token: string;
}

export interface RevokeTokenRequest {
  tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">;
}

export const localBootstrapRequestSchema: Schema<LocalBootstrapRequest> =
  objectSchema({
    bootstrapToken: stringSchema({ minLength: 1 }),
    machineName: stringSchema({ minLength: 1 }),
  });

export const localBootstrapResponseSchema: Schema<LocalBootstrapResponse> =
  objectSchema({
    tokens: objectSchema({
      skill: stringSchema({ pattern: /^pf_skill_[A-Za-z0-9_-]+$/ }),
      dispatcher: stringSchema({ pattern: /^pf_dispatcher_[A-Za-z0-9_-]+$/ }),
      local: stringSchema({ pattern: /^pf_local_[A-Za-z0-9_-]+$/ }),
    }),
  });

export const rotateTokenRequestSchema: Schema<RotateTokenRequest> =
  objectSchema({
    tokenType: enumSchema(
      tokenTypes.filter(
        (value) =>
          value === "skill" || value === "dispatcher" || value === "local",
      ) as ["skill", "dispatcher", "local"],
    ),
  });

export const rotateTokenResponseSchema: Schema<RotateTokenResponse> =
  objectSchema({
    token: stringSchema({
      pattern: /^pf_(skill|dispatcher|local)_[A-Za-z0-9_-]+$/,
    }),
  });

export const revokeTokenRequestSchema: Schema<RevokeTokenRequest> =
  rotateTokenRequestSchema;
