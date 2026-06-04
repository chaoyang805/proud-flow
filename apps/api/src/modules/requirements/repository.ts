import type {
  Artifact,
  Priority,
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

export class InMemoryRequirementRepository {
  private requirements = new Map<string, Requirement>();
  private artifacts = new Map<string, Artifact>();
  private apiTokens = new Map<string, ApiTokenRecord>();
  private requirementCounter = 0;
  private artifactCounter = 0;
  private tokenCounter = 0;

  createRequirement(input: RequirementCreateInput): Requirement {
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

  listRequirements(): Requirement[] {
    return [...this.requirements.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  getRequirement(id: string): Requirement | undefined {
    return this.requirements.get(id);
  }

  updateRequirement(
    id: string,
    input: RequirementUpdateInput,
  ): Requirement | undefined {
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

  createArtifact(input: ArtifactCreateInput): Artifact {
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

  listArtifacts(requirementId: string): Artifact[] {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.requirementId === requirementId,
    );
  }

  createApiToken(input: {
    tokenHash: string;
    tokenType: Extract<TokenType, "skill" | "dispatcher" | "local">;
    machineName?: string;
  }): ApiTokenRecord {
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
