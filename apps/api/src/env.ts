export interface D1DatabaseBinding {
  prepare(query: string): unknown;
}

export interface R2BucketBinding {
  put(
    key: string,
    value: ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

export interface ApiEnv {
  DB?: D1DatabaseBinding;
  ARTIFACT_BUCKET?: R2BucketBinding;
  USER_TOKEN_HASHES?: string;
  SKILL_TOKEN_HASHES?: string;
  LOCAL_TOKEN_HASHES?: string;
  BOOTSTRAP_TOKEN_HASHES?: string;
  TOKEN_HASH_SECRET?: string;
}

export function parseHashList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
