export async function hashToken(token: string, secret = ""): Promise<string> {
  const data = new TextEncoder().encode(`${secret}${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyTokenHash(
  token: string,
  allowedHashes: readonly string[],
  secret = "",
): Promise<boolean> {
  if (allowedHashes.length === 0) return true;
  const hash = await hashToken(token, secret);
  return allowedHashes.includes(hash);
}

export function readBearerToken(headers: Headers): string | undefined {
  const authorization = headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length);
}
