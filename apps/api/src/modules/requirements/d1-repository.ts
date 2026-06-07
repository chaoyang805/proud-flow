import type { Artifact, DispatchStage, Priority, Requirement, RequirementStatus, TokenType } from "@proud-flow/domain";
import type { ApiTokenRecord, ArtifactCreateInput, IRequirementRepository, RequirementCreateInput, RequirementUpdateInput } from "./repository";

interface D1Row { [key: string]: unknown; }
interface D1Result<T = D1Row> { results?: T[]; }
interface D1Stmt {
  bind(...args: unknown[]): D1Stmt;
  run(): Promise<unknown>;
  all<T = D1Row>(): Promise<D1Result<T>>;
  first<T = D1Row>(): Promise<T | null>;
}
interface D1Database { prepare(query: string): D1Stmt; }

type TokenCategory = Extract<TokenType, "skill" | "dispatcher" | "local">;

export class D1RequirementRepository implements IRequirementRepository {
  private apiTokenHashes = new Map<TokenCategory, string[]>();
  private requirementCounter = 0;
  private artifactCounter = 0;
  private tokenCounter = 0;
  private initPromise: Promise<void>;

  constructor(private readonly db: D1Database) {
    this.initPromise = this.initialize();
  }

  async ready(): Promise<void> { await this.initPromise; }

  private async initialize(): Promise<void> {
    console.log("[d1-repo] initializing D1 repository...");
    await this.ensureSchema();
    await this.loadTokens();
    await this.loadCounters();
    console.log(`[d1-repo] initialized (${this.requirementCounter} requirements, ${this.tokenCounter} tokens)`);
  }

  private async ensureSchema(): Promise<void> {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS requirements (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, requirement_id TEXT NOT NULL, requirement_version INTEGER NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, url TEXT, content TEXT, created_at TEXT NOT NULL, FOREIGN KEY(requirement_id) REFERENCES requirements(id))`,
      `CREATE TABLE IF NOT EXISTS api_tokens (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, token_type TEXT NOT NULL, created_at TEXT NOT NULL, revoked_at TEXT)`,
    ];
    for (const sql of stmts) {
      await this.db.prepare(sql).run();
    }
    console.log("[d1-repo] schema ensured");
  }

  private async loadTokens(): Promise<void> {
    const types: TokenCategory[] = ["skill", "dispatcher", "local"];
    for (const tokenType of types) {
      const result = await this.db.prepare(
        "SELECT token_hash FROM api_tokens WHERE token_type = ? AND revoked_at IS NULL",
      ).bind(tokenType).all<{ token_hash: string }>();
      this.apiTokenHashes.set(tokenType, (result.results ?? []).map((r) => r.token_hash));
    }
    console.log(`[d1-repo] loaded tokens from D1: skill=${this.apiTokenHashes.get("skill")?.length ?? 0} dispatcher=${this.apiTokenHashes.get("dispatcher")?.length ?? 0} local=${this.apiTokenHashes.get("local")?.length ?? 0}`);
  }

  private async loadCounters(): Promise<void> {
    const req = await this.db.prepare("SELECT id FROM requirements ORDER BY id DESC LIMIT 1").first<{ id: string }>();
    if (req) this.requirementCounter = parseInt(req.id.replace("REQ-", ""), 10);

    const art = await this.db.prepare("SELECT id FROM artifacts ORDER BY id DESC LIMIT 1").first<{ id: string }>();
    if (art) this.artifactCounter = parseInt(art.id.replace("art_", ""), 10);

    const tok = await this.db.prepare("SELECT id FROM api_tokens ORDER BY id DESC LIMIT 1").first<{ id: string }>();
    if (tok) this.tokenCounter = parseInt(tok.id.replace("tok_", ""), 10);

  }

  // ==================== Requirements ====================

  async createRequirement(input: RequirementCreateInput): Promise<Requirement> {
    this.requirementCounter += 1;
    const id = `REQ-${this.requirementCounter.toString().padStart(6, "0")}`;
    const now = new Date().toISOString();
    const requirement: Requirement = {
      id, title: input.title, description: input.description,
      priority: input.priority, status: "planning", version: 1,
      createdAt: now, updatedAt: now,
    };
    void this.db.prepare(
      "INSERT INTO requirements (id, title, description, status, priority, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, input.title, input.description, "planning", input.priority, 1, now, now).run();
    console.log(`[d1-repo] requirement created: ${id}`);
    return requirement;
  }

  async listRequirements(): Promise<Requirement[]> {
    const result = await this.db.prepare(
      "SELECT id, title, description, status, priority, version, created_at, updated_at FROM requirements ORDER BY created_at DESC",
    ).all<{ id: string; title: string; description: string; status: string; priority: string; version: number; created_at: string; updated_at: string }>();
    return (result.results ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as RequirementStatus,
      priority: row.priority as Priority,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getRequirement(id: string): Promise<Requirement | undefined> {
    const row = await this.db.prepare(
      "SELECT id, title, description, status, priority, version, created_at, updated_at FROM requirements WHERE id = ?",
    ).bind(id).first<{ id: string; title: string; description: string; status: string; priority: string; version: number; created_at: string; updated_at: string }>();
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as RequirementStatus,
      priority: row.priority as Priority,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateRequirement(id: string, input: RequirementUpdateInput): Promise<Requirement | undefined> {
    const existing = await this.getRequirement(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const updated: Requirement = { ...existing, ...input, updatedAt: now };
    await this.db.prepare(
      "UPDATE requirements SET title = ?, description = ?, status = ?, priority = ?, version = ?, updated_at = ? WHERE id = ?",
    ).bind(updated.title, updated.description, updated.status, updated.priority, updated.version, now, id).run();

    console.log(`[d1-repo] requirement updated: ${id} status=${updated.status} version=${updated.version}`);
    return updated;
  }

  // ==================== Artifacts ====================

  async createArtifact(input: ArtifactCreateInput): Promise<Artifact> {
    this.artifactCounter += 1;
    const id = `art_${this.artifactCounter.toString().padStart(6, "0")}`;
    const now = new Date().toISOString();
    const artifact: Artifact = {
      id,
      requirementId: input.requirementId,
      requirementVersion: input.requirementVersion,
      type: input.type,
      title: input.title,
      url: input.url,
      content: input.content,
      createdAt: now,
    };
    await this.db.prepare(
      "INSERT INTO artifacts (id, requirement_id, requirement_version, type, title, url, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, input.requirementId, input.requirementVersion, input.type, input.title, input.url ?? null, input.content ?? null, now).run();
    console.log(`[d1-repo] artifact created: ${id} requirement=${input.requirementId} type=${input.type}`);
    return artifact;
  }

  async listArtifacts(requirementId: string): Promise<Artifact[]> {
    const result = await this.db.prepare(
      "SELECT id, requirement_id, requirement_version, type, title, url, content, created_at FROM artifacts WHERE requirement_id = ? ORDER BY created_at DESC",
    ).bind(requirementId).all<{ id: string; requirement_id: string; requirement_version: number; type: string; title: string; url: string | null; content: string | null; created_at: string }>();
    return (result.results ?? []).map((row) => ({
      id: row.id,
      requirementId: row.requirement_id,
      requirementVersion: row.requirement_version,
      type: row.type as Artifact["type"],
      title: row.title,
      url: row.url ?? undefined,
      content: row.content ?? undefined,
      createdAt: row.created_at,
    }));
  }

  // ==================== Tokens ====================

  createApiToken(input: { tokenHash: string; tokenType: TokenCategory; machineName?: string }): ApiTokenRecord {
    this.tokenCounter += 1;
    const id = `tok_${this.tokenCounter.toString().padStart(6, "0")}`;
    const now = new Date().toISOString();
    const record: ApiTokenRecord = { id, tokenHash: input.tokenHash, tokenType: input.tokenType, machineName: input.machineName, createdAt: now };
    void this.db.prepare(
      "INSERT INTO api_tokens (id, token_hash, token_type, created_at) VALUES (?, ?, ?, ?)",
    ).bind(id, input.tokenHash, input.tokenType, now).run();
    const hashes = this.apiTokenHashes.get(input.tokenType) ?? [];
    hashes.push(input.tokenHash);
    this.apiTokenHashes.set(input.tokenType, hashes);
    console.log(`[d1-repo] api token created: ${id} type=${input.tokenType}`);
    return record;
  }

  listActiveApiTokenHashes(tokenType: TokenCategory): string[] {
    return this.apiTokenHashes.get(tokenType) ?? [];
  }

  revokeApiTokens(tokenType: TokenCategory): void {
    const now = new Date().toISOString();
    void this.db.prepare(
      "UPDATE api_tokens SET revoked_at = ? WHERE token_type = ? AND revoked_at IS NULL",
    ).bind(now, tokenType).run();
    this.apiTokenHashes.set(tokenType, []);
    console.log(`[d1-repo] api tokens revoked: type=${tokenType}`);
  }




}
