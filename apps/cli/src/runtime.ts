import process from "node:process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
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
  writeFile(path: string, content: Uint8Array): Promise<void>;
  listFiles(pathPrefix: string): Promise<string[]>;
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
    async writeFile(path, content) {
      files.set(path, content);
    },
    async listFiles(pathPrefix) {
      return Array.from(files.keys()).filter((path) =>
        path.startsWith(pathPrefix),
      );
    },
  };
}

export function createNodeCliRuntime(
  options: {
    fetch?: typeof fetch;
    env?: Record<string, string | undefined>;
    cwd?: string;
    configDir?: string;
  } = {},
): CliRuntime {
  const env = options.env ?? process.env;
  const configDir =
    options.configDir ??
    env.PROUD_FLOW_CONFIG_DIR ??
    join(homedir(), ".proud-flow");
  const configPath = join(configDir, "config.json");
  const tokenPath = join(configDir, "tokens.json");

  return {
    fetch: options.fetch ?? fetch,
    env,
    cwd: options.cwd ?? process.cwd(),
    store: {
      async readConfig() {
        return readJsonFile<CliConfig>(configPath);
      },
      async writeConfig(config) {
        await writeJsonFile(configPath, config);
      },
      async clearConfig() {
        await rm(configPath, { force: true });
      },
    },
    keychain: {
      async getToken(type) {
        const tokens = (await readJsonFile<Partial<Record<StoredTokenType, string>>>(
          tokenPath,
        )) ?? {};
        return tokens[type];
      },
      async setToken(type, token) {
        const tokens = (await readJsonFile<Partial<Record<StoredTokenType, string>>>(
          tokenPath,
        )) ?? {};
        await writeJsonFile(tokenPath, { ...tokens, [type]: token });
      },
      async deleteToken(type) {
        const tokens = (await readJsonFile<Partial<Record<StoredTokenType, string>>>(
          tokenPath,
        )) ?? {};
        delete tokens[type];
        await writeJsonFile(tokenPath, tokens);
      },
    },
    async readFile(path) {
      return readFile(path);
    },
    async writeFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    async listFiles(pathPrefix) {
      return listFilesRecursive(pathPrefix);
    },
  };
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function listFilesRecursive(pathPrefix: string): Promise<string[]> {
  const entries = await readdir(pathPrefix, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = join(pathPrefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
