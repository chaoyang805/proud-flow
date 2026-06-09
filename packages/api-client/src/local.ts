import {
  localBootstrapRequestSchema,
  localBootstrapResponseSchema,
  rotateTokenRequestSchema,
  rotateTokenResponseSchema,
  revokeTokenRequestSchema,
  type LocalBootstrapRequest,
  type LocalBootstrapResponse,
  type RotateTokenRequest,
  type RotateTokenResponse,
  type RevokeTokenRequest,
} from "@proud-flow/api-contract";
import type { ProudFlowHttpClient } from "./client";

export class LocalApiClient {
  constructor(private readonly http: ProudFlowHttpClient) {}

  bootstrap(body: LocalBootstrapRequest): Promise<LocalBootstrapResponse> {
    return this.http.request({
      method: "POST",
      path: "/api/local/bootstrap",
      requestSchema: localBootstrapRequestSchema,
      responseSchema: localBootstrapResponseSchema,
      body,
    });
  }

  rotateToken(body: RotateTokenRequest): Promise<RotateTokenResponse> {
    return this.http.request({
      method: "POST",
      path: "/api/local/tokens/rotate",
      requestSchema: rotateTokenRequestSchema,
      responseSchema: rotateTokenResponseSchema,
      body,
    });
  }

  revokeToken(body: RevokeTokenRequest): Promise<Record<string, never>> {
    return this.http.request({
      method: "POST",
      path: "/api/local/tokens/revoke",
      requestSchema: revokeTokenRequestSchema,
      body,
    });
  }
}
