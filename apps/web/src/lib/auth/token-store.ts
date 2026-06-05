"use client";

const tokenKey = "proud-flow.user-token";

export function getStoredUserToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(tokenKey) ?? undefined;
}

export function setStoredUserToken(token: string): void {
  window.localStorage.setItem(tokenKey, token);
}

export function clearStoredUserToken(): void {
  window.localStorage.removeItem(tokenKey);
}

