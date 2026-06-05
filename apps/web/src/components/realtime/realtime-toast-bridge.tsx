"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getApiBaseUrl } from "../../lib/api/client";
import { getStoredUserToken } from "../../lib/auth/token-store";
import { queryKeys } from "../../lib/query/keys";
import { parseRealtimeEvent, type RealtimeEvent } from "../../lib/realtime/events";

interface Toast {
  id: string;
  tone: "info" | "success" | "error";
  message: string;
}

export function RealtimeToastBridge() {
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<"idle" | "connected" | "lost">("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const token = getStoredUserToken();
    if (!token) return;
    let socket: WebSocket | undefined;
    let disposed = false;
    let retryMs = 600;

    const connect = () => {
      const wsUrl = `${getApiBaseUrl().replace(/^http/, "ws")}/api/realtime/ws`;
      socket = new WebSocket(wsUrl);
      socket.onopen = () => {
        retryMs = 600;
        setConnection("connected");
        void queryClient.invalidateQueries();
      };
      socket.onmessage = (message) => {
        if (typeof message.data !== "string") return;
        const event = parseRealtimeEvent(message.data);
        if (!event || seen.current.has(event.eventId)) return;
        seen.current.add(event.eventId);
        handleRealtimeEvent(event, queryClient, setToasts);
      };
      socket.onclose = () => {
        if (disposed) return;
        setConnection("lost");
        window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 8_000);
      };
    };

    connect();
    return () => {
      disposed = true;
      socket?.close();
    };
  }, [queryClient]);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
      {connection === "lost" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
          <span className="inline-flex items-center gap-2">
            <WifiOff size={15} aria-hidden />
            实时连接已断开，正在重连
          </span>
        </div>
      ) : connection === "connected" ? (
        <div className="sr-only">
          <Wifi size={15} aria-hidden />
          connected
        </div>
      ) : null}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md border px-3 py-2 text-sm shadow-sm ${toastClass(toast.tone)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{toast.message}</span>
            <button
              type="button"
              className="focus-ring rounded-sm"
              title="关闭"
              onClick={() =>
                setToasts((items) => items.filter((item) => item.id !== toast.id))
              }
            >
              <X size={15} aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function handleRealtimeEvent(
  event: RealtimeEvent,
  queryClient: ReturnType<typeof useQueryClient>,
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>,
) {
  void queryClient.invalidateQueries({ queryKey: ["requirements"] });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.requirements.detail(event.requirementId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.requirements.artifacts(event.requirementId),
  });

  const tone = event.type === "dispatch.acked" && event.success ? "success" : event.type === "ai_stage.failed" ? "error" : "info";
  const message =
    event.message ??
    (event.type === "dispatch.acked"
      ? event.success
        ? "派发已确认"
        : "派发失败"
      : "需求已更新");
  setToasts((items) => [
    ...items.slice(-3),
    { id: event.eventId, tone, message },
  ]);
}

function toastClass(tone: Toast["tone"]): string {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-sky-200 bg-sky-50 text-sky-800";
}

