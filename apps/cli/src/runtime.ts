import process from "node:process";
import type { TokenType } from "@proud-flow/domain";

export interface CliConfig {
  environment?: "prod" | "dev";
  machineName?: string;
  workspacePath: string;
}

export type StoredTokenType = Extract<
  TokenType,
  "skill" | "dispatcher" | "local"
>;

export interface CliConfigStore {
  readConfig(): Promise<CliConfig | undefined>;
  writeConfig(config: CliConfig): Promise<void>;
  clearConfig(): Promise<void>;
}

export interface CliKeychain {
  getToken(type: StoredTokenType): Promise<string | undefined>;
  setToken(type: StoredTokenType, token: string): Promise<void>;
  deleteToken(type: StoredTokenType): Promise<void>;
}

export interface CliRuntime {
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  cwd: string;
  store: CliConfigStore;
  keychain: CliKeychain;
  readFile(path: string): Promise<Uint8Array>;
}

export function createMemoryCliRuntime(
  options: {
    fetch?: typeof fetch;
    env?: Record<string, string | undefined>;
    files?: Map<string, Uint8Array>;
  } = {},
): CliRuntime {
  let config: CliConfig | undefined;
  const tokens = new Map<StoredTokenType, string>();
  const files = options.files ?? new Map<string, Uint8Array>();
  return {
    fetch: options.fetch ?? fetch,
    env: options.env ?? {},
    cwd: process.cwd(),
    store: {
      async readConfig() {
        return config;
      },
      async writeConfig(value) {
        config = { ...value };
      },
      async clearConfig() {
        config = undefined;
      },
    },
    keychain: {
      async getToken(type) {
        return tokens.get(type);
      },
      async setToken(type, token) {
        tokens.set(type, token);
      },
      async deleteToken(type) {
        tokens.delete(type);
      },
    },
    async readFile(path) {
      const value = files.get(path);
      if (!value) throw new Error(`File not found: ${path}`);
      return value;
    },
  };
}
