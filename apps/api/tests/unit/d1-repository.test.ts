// @ts-nocheck
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "vitest";
import { D1RequirementRepository } from "../../src/modules/requirements/d1-repository";

function createMockDb() {
  const tables: Record<string, Map<string, Record<string, unknown>>> = {
    requirements: new Map(),
    artifacts: new Map(),
    api_tokens: new Map(),
  };

  function resolveTable(sql: string): string {
    for (const table of Object.keys(tables)) {
      if (sql.includes(table)) return table;
    }
    return "";
  }

  function runInsert(table: string, args: unknown[]) {
    const row: Record<string, unknown> = {};
    const cols = ["id", "title", "description", "status", "priority", "version", "created_at", "updated_at"];
    if (table === "requirements") {
      for (let i = 0; i < args.length; i++) row[cols[i]] = args[i];
    } else if (table === "artifacts") {
      const acols = ["id", "requirement_id", "requirement_version", "type", "title", "url", "content", "created_at"];
      for (let i = 0; i < args.length; i++) row[acols[i]] = args[i];
    } else if (table === "api_tokens") {
      const tcols = ["id", "token_hash", "token_type", "created_at"];
      for (let i = 0; i < args.length; i++) row[tcols[i]] = args[i];
    }
    tables[table].set(row.id as string, row);
  }

  const db = {
    prepare(sql: string) {
      const table = resolveTable(sql);
      let boundArgs: unknown[] = [];
      return {
        bind(...args: unknown[]) {
          boundArgs = args;
          return this;
        },
        async run() {
          if (sql.toUpperCase().includes("INSERT")) {
            runInsert(table, boundArgs);
          } else if (sql.toUpperCase().includes("UPDATE")) {
            const map = tables[table];
            for (const [id, row] of map) {
              if (table === "api_tokens" && sql.includes("revoked_at")) {
                row.revoked_at = boundArgs[0];
              }
              if (table === "requirements" && sql.includes("SET title")) {
                row.title = boundArgs[0];
                row.description = boundArgs[1];
                row.status = boundArgs[2];
                row.priority = boundArgs[3];
                row.version = boundArgs[4];
                row.updated_at = boundArgs[5];
              }
            }
          }
        },
        async all<T>() {
          const map = tables[table];
          const rows = [...map.values()] as T[];
          return { results: rows };
        },
        async first<T>() {
          const map = tables[table];
          const rows = [...map.values()];
          if (sql.includes("WHERE id = ?") || sql.includes("WHERE request_id = ?")) {
            return (rows.find((r) => (r as any).id === boundArgs[0] || (r as any).request_id === boundArgs[0]) ?? null) as T | null;
          }
          if (sql.includes("requirement_id = ?")) {
            return (rows.find((r) => (r as any).requirement_id === boundArgs[0]) ?? null) as T | null;
          }
          if (sql.includes("token_type = ?")) {
            const filtered = rows.filter((r) => (r as any).token_type === boundArgs[0] && !(r as any).revoked_at);
            if (sql.includes("LIMIT 1")) return (filtered[0] ?? null) as T | null;
          }
          return (rows[0] ?? null) as T | null;
        },
      };
    },
  };
  return db;
}

describe("D1RequirementRepository", () => {
  let db: ReturnType<typeof createMockDb>;
  let repo: D1RequirementRepository;

  beforeEach(async () => {
    db = createMockDb();
    repo = new D1RequirementRepository(db as any);
    await repo.ready();
  });

  it("creates and lists requirements", async () => {
    const req = await repo.createRequirement({ title: "测试", description: "描述", priority: "high" });
    assert.equal(req.id, "REQ-000001");
    assert.equal(req.status, "planning");

    const list = await repo.listRequirements();
    assert.equal(list.length, 1);
    assert.equal(list[0].title, "测试");
  });

  it("gets requirement by id", async () => {
    const created = await repo.createRequirement({ title: "查", description: "找", priority: "medium" });
    const found = await repo.getRequirement(created.id);
    assert.ok(found);
    assert.equal(found!.title, "查");

    const missing = await repo.getRequirement("REQ-999999");
    assert.equal(missing, undefined);
  });

  it("updates requirement status", async () => {
    const created = await repo.createRequirement({ title: "改", description: "变", priority: "low" });
    const updated = await repo.updateRequirement(created.id, { status: "tech-design" });
    assert.ok(updated);
    assert.equal(updated!.status, "tech-design");
  });

  it("creates and lists artifacts", async () => {
    const req = await repo.createRequirement({ title: "物", description: "品", priority: "medium" });
    const art = await repo.createArtifact({
      requirementId: req.id,
      requirementVersion: 1,
      type: "document",
      title: "设计文档",
      url: "https://example.com/doc",
    });
    assert.ok(art.id.startsWith("art_"));
    assert.equal(art.requirementId, req.id);

    const list = await repo.listArtifacts(req.id);
    assert.equal(list.length, 1);
    assert.equal(list[0].title, "设计文档");
  });

  it("creates, lists, and revokes api tokens", () => {
    const record = repo.createApiToken({ tokenHash: "hash1", tokenType: "dispatcher", machineName: "test" });
    assert.ok(record.id.startsWith("tok_"));
    assert.equal(record.tokenType, "dispatcher");

    const hashes = repo.listActiveApiTokenHashes("dispatcher");
    assert.ok(hashes.includes("hash1"));

    repo.revokeApiTokens("dispatcher");
    const after = repo.listActiveApiTokenHashes("dispatcher");
    assert.equal(after.length, 0);
  });


});
