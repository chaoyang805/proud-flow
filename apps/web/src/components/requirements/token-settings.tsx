"use client";

import { KeyRound, LogOut, Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearStoredUserToken,
  getStoredUserToken,
  setStoredUserToken,
} from "../../lib/auth/token-store";

export function TokenSettings() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    setToken(getStoredUserToken() ?? "");
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-[var(--line)] bg-white text-zinc-700 hover:bg-zinc-50"
        title="用户 token"
        onClick={() => setOpen((value) => !value)}
      >
        <KeyRound size={16} aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-20 w-80 rounded-md border border-[var(--line)] bg-white p-3 shadow-lg">
          <label className="block text-xs font-medium text-zinc-600" htmlFor="user-token">
            User token
          </label>
          <input
            id="user-token"
            className="focus-ring mt-2 h-10 w-full rounded-md border border-[var(--line)] px-3 text-sm"
            value={token}
            placeholder="Bearer token"
            onChange={(event) => setToken(event.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-[var(--line)] px-3 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => {
                clearStoredUserToken();
                setToken("");
                window.location.reload();
              }}
            >
              <LogOut size={15} aria-hidden />
              清除
            </button>
            <button
              type="button"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => {
                if (token.trim()) setStoredUserToken(token.trim());
                setOpen(false);
                window.location.reload();
              }}
            >
              <Save size={15} aria-hidden />
              保存
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

