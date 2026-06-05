"use client";

import { createProudFlowApiClient } from "@proud-flow/api-client";
import { getStoredUserToken } from "../auth/token-store";

export function getApiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_PROUD_FLOW_API_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:8787"
  );
}

export function createWebApiClient(token = getStoredUserToken()) {
  return createProudFlowApiClient({
    baseUrl: getApiBaseUrl(),
    token,
  });
}

