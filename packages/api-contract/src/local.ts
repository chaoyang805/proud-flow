import { tokenTypes, type TokenType } from "@proud-flow/domain";
import {
  arraySchema,
  enumSchema,
  objectSchema,
  stringSchema,
  type Schema,
} from "./schema.js";

export interface LocalBootstrapRequest {
  bootstrapToken: string;
  machineName: string;
}

export interface LocalBootstrapResponse {
  tokens: {
    skill: string;
    dispatcher: string;
  };
}

export interface RotateTokenRequest {
  tokenType: Extract<TokenType, "skill" | "dispatcher">;
}

export interface RotateTokenResponse {
  token: string;
}

export interface RevokeTokenRequest {
  tokenType: Extract<TokenType, "skill" | "dispatcher">;
}

export interface SkillManifestEntry {
  name: "tech-design" | "case-rundown" | "development";
  version: string;
  downloadUrl: string;
  sha256: string;
}

export interface SkillManifestResponse {
  version: string;
  cliVersionRange: string;
  skills: SkillManifestEntry[];
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
    }),
  });

export const rotateTokenRequestSchema: Schema<RotateTokenRequest> =
  objectSchema({
    tokenType: enumSchema(
      tokenTypes.filter(
        (value) => value === "skill" || value === "dispatcher",
      ) as ["skill", "dispatcher"],
    ),
  });

export const rotateTokenResponseSchema: Schema<RotateTokenResponse> =
  objectSchema({
    token: stringSchema({ pattern: /^pf_(skill|dispatcher)_[A-Za-z0-9_-]+$/ }),
  });

export const revokeTokenRequestSchema: Schema<RevokeTokenRequest> =
  rotateTokenRequestSchema;

export const skillManifestEntrySchema: Schema<SkillManifestEntry> =
  objectSchema({
    name: enumSchema(["tech-design", "case-rundown", "development"] as const),
    version: stringSchema({ minLength: 1 }),
    downloadUrl: stringSchema({ minLength: 1 }),
    sha256: stringSchema({ minLength: 1 }),
  });

export const skillManifestResponseSchema: Schema<SkillManifestResponse> =
  objectSchema({
    version: stringSchema({ minLength: 1 }),
    cliVersionRange: stringSchema({ minLength: 1 }),
    skills: arraySchema(skillManifestEntrySchema),
  });
