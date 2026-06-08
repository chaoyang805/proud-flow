import type { ApiEnv } from "../env";
import { DISPATCH_DO_NAME, REALTIME_DO_NAME } from "./do-request";
import type { DoStub } from "./fetch-do";

export function hasDoBindings(env: ApiEnv): boolean {
  return Boolean(env.DISPATCH_DO && env.REALTIME_DO);
}

export function getDispatchStub(env: ApiEnv): DoStub {
  if (!env.DISPATCH_DO) {
    throw new Error("DISPATCH_DO binding is not configured");
  }
  return env.DISPATCH_DO.get(
    env.DISPATCH_DO.idFromName(DISPATCH_DO_NAME),
  ) as unknown as DoStub;
}

export function getRealtimeStub(env: ApiEnv): DoStub {
  if (!env.REALTIME_DO) {
    throw new Error("REALTIME_DO binding is not configured");
  }
  return env.REALTIME_DO.get(
    env.REALTIME_DO.idFromName(REALTIME_DO_NAME),
  ) as unknown as DoStub;
}
