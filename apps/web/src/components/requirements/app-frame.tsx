"use client";

import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { TokenSettings } from "./token-settings";

export function AppFrame({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/86">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/requirements"
            className="focus-ring flex items-center gap-3 rounded-md"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-teal-700 text-white">
              <ClipboardList size={18} aria-hidden />
            </span>
            <span className="text-base font-semibold">Proud Flow</span>
          </Link>
          <nav className="flex items-center gap-2">
            <TokenSettings />
            <Link
              href="/requirements/new"
              className="focus-ring inline-flex h-9 items-center gap-2 rounded-md bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800"
            >
              <Plus size={16} aria-hidden />
              <span>新建</span>
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">{children}</main>
    </div>
  );
}
