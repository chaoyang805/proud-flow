import type {
  Artifact,
  Priority,
  RealtimeEvent,
  Requirement,
  RequirementStatus,
  TokenType,
} from "@proud-flow/domain";

export interface RequirementCreateInput {
  title: string;
  description: string;
  priority: Priority;
}

export interface RequirementUpdateInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: RequirementStatus;
  version?: number;
}

export interface ArtifactCreateInput {
  requirementId: string;
  requirementVersion: number;
  type: Artifact["type"];
  title: string;
  url?: string;
  content?: string;
}

export interface ApiTokenRecord {
  id: string;
  tokenHash: string;
  tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">;
  machineName?: string;
  createdAt: string;
  revokedAt?: string;
}

export interface IRequirementRepository {
  createRequirement(input: RequirementCreateInput): Promise<Requirement>;
  listRequirements(): Promise<Requirement[]>;
  getRequirement(id: string): Promise<Requirement | undefined>;
  updateRequirement(id: string, input: RequirementUpdateInput): Promise<Requirement | undefined>;
  createArtifact(input: ArtifactCreateInput): Promise<Artifact>;
  listArtifacts(requirementId: string): Promise<Artifact[]>;
  createApiToken(input: { tokenHash: string; tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">; machineName?: string }): Promise<ApiTokenRecord>;
  listActiveApiTokenHashes(tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">): string[];
  revokeApiTokens(tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">): void;
}

export class InMemoryRequirementRepository implements IRequirementRepository {
  private requirements = new Map<string, Requirement>();
  private artifacts = new Map<string, Artifact>();
  private apiTokens = new Map<string, ApiTokenRecord>();
  private requirementCounter = 0;
  private artifactCounter = 0;
  private tokenCounter = 0;

  async createRequirement(input: RequirementCreateInput): Promise<Requirement> {
    const now = new Date().toISOString();
    this.requirementCounter += 1;
    const requirement: Requirement = {
      id: `REQ-${this.requirementCounter.toString().padStart(6, "0")}`,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "planning",
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.requirements.set(requirement.id, requirement);
    return requirement;
  }

  async listRequirements(): Promise<Requirement[]> {
    return [...this.requirements.values()];
  }

  async getRequirement(id: string): Promise<Requirement | undefined> {
    return this.requirements.get(id);
  }

  async updateRequirement(
    id: string,
    input: RequirementUpdateInput,
  ): Promise<Requirement | undefined> {
    const existing = this.requirements.get(id);
    if (!existing) return undefined;
    const updated: Requirement = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    this.requirements.set(id, updated);
    return updated;
  }

  async createArtifact(input: ArtifactCreateInput): Promise<Artifact> {
    this.artifactCounter += 1;
    const artifact: Artifact = {
      id: `art_${this.artifactCounter.toString().padStart(6, "0")}`,
      requirementId: input.requirementId,
      requirementVersion: input.requirementVersion,
      type: input.type,
      title: input.title,
      url: input.url,
      content: input.content,
      createdAt: new Date().toISOString(),
    };
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  async listArtifacts(requirementId: string): Promise<Artifact[]> {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.requirementId === requirementId,
    );
  }

  async createApiToken(input: {
    tokenHash: string;
    tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">;
    machineName?: string;
  }): Promise<ApiTokenRecord> {
    this.tokenCounter += 1;
    const record: ApiTokenRecord = {
      id: `tok_${this.tokenCounter.toString().padStart(6, "0")}`,
      tokenHash: input.tokenHash,
      tokenType: input.tokenType,
      machineName: input.machineName,
      createdAt: new Date().toISOString(),
    };
    this.apiTokens.set(record.id, record);
    return record;
  }

  listActiveApiTokenHashes(
    tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">,
  ): string[] {
    return [...this.apiTokens.values()]
      .filter((record) => record.tokenType === tokenType && !record.revokedAt)
      .map((record) => record.tokenHash);
  }

  revokeApiTokens(
    tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">,
  ): void {
    const now = new Date().toISOString();
    for (const record of this.apiTokens.values()) {
      if (record.tokenType === tokenType && !record.revokedAt) {
        this.apiTokens.set(record.id, { ...record, revokedAt: now });
      }
    }
  }



}
