import {
  dispatchPushResponseSchema,
  type DispatchPushResponse,
} from "@proud-flow/api-contract";
import type { DispatchRequestedMessage } from "@proud-flow/domain";
import {
  createDoRequest,
  DO_PATH_DISPATCH,
  DO_PATH_STATUS,
} from "./do-request";
import type { DoStub } from "./fetch-do";
import { fetchDo } from "./fetch-do";

export async function pushDispatchViaDo(
  stub: DoStub,
  message: DispatchRequestedMessage,
): Promise<DispatchPushResponse> {
  const response = await fetchDo(
    stub,
    createDoRequest(DO_PATH_DISPATCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    }),
  );
  return dispatchPushResponseSchema.parse(await response.json());
}

export async function getDispatchStatusViaDo(
  stub: DoStub,
): Promise<{ online: boolean; connectionCount: number }> {
  const response = await fetchDo(stub, createDoRequest(DO_PATH_STATUS));
  return response.json() as Promise<{ online: boolean; connectionCount: number }>;
}
