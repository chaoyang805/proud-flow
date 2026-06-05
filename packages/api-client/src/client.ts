import type { Schema } from "@proud-flow/api-contract";
import { parseErrorResponse } from "./errors";

export interface ProudFlowClientOptions {
  baseUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

export interface RequestOptions<TRequest, TResponse> {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  requestSchema?: Schema<TRequest>;
  responseSchema?: Schema<TResponse>;
  body?: TRequest;
  token?: string;
}

export class ProudFlowHttpClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ProudFlowClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async request<TRequest, TResponse>(
    options: RequestOptions<TRequest, TResponse>,
  ): Promise<TResponse> {
    if (options.requestSchema && options.body !== undefined) {
      options.requestSchema.parse(options.body);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${options.path}`, {
      method: options.method,
      headers: this.createHeaders(options.token, options.body !== undefined),
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw parseErrorResponse(response.status, payload);
    }

    if (!options.responseSchema) {
      return payload as TResponse;
    }

    return options.responseSchema.parse(payload);
  }

  private createHeaders(
    token: string | undefined,
    hasBody: boolean,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    if (hasBody) headers["Content-Type"] = "application/json";
    const bearerToken = token ?? this.token;
    if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
    return headers;
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return {};
  return JSON.parse(text) as unknown;
}
