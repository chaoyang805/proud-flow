"use client";

import { ClipboardList, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearStoredUserToken,
  getStoredUserToken,
  setStoredUserToken,
} from "../../lib/auth/token-store";

export function TokenGuard({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUserToken();
    setToken(stored ?? null);
    setLoading(false);
  }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setStoredUserToken(trimmed);
    setToken(trimmed);
    router.refresh();
  };

  const handleClear = () => {
    clearStoredUserToken();
    setToken(null);
    setInput("");
    router.refresh();
  };

  if (loading) return null;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="w-full max-w-sm rounded-md border border-[var(--line)] bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-teal-700 text-white">
              <ClipboardList size={24} />
            </span>
            <h1 className="text-lg font-semibold text-zinc-900">Proud Flow</h1>
            <p className="text-sm text-zinc-500">
              请配置 User Token 以开始使用工作台。
              <br />
              首次使用请通过 CLI 执行 <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">proud-flow init</code> 获取 token。
            </p>
          </div>

          <div className="mt-6">
            <label
              htmlFor="guard-token-input"
              className="block text-xs font-medium text-zinc-600"
            >
              User Token
            </label>
            <input
              id="guard-token-input"
              className="focus-ring mt-2 h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
              value={input}
              placeholder="粘贴你的 User Token"
              onChange={(e) => setInput(e.target.value)}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              disabled
            >
              跳过
            </button>
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              disabled={!input.trim()}
              onClick={handleSave}
            >
              <KeyRound size={15} aria-hidden />
              保存并进入
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
