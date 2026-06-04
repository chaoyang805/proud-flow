import type { SkillManifestResponse } from "@proud-flow/api-contract";

const skillNames = ["tech-design", "case-rundown", "development"] as const;

export function createSkillManifest(): SkillManifestResponse {
  return {
    version: "0.1.0",
    cliVersionRange: ">=0.1.0",
    skills: skillNames.map((name) => ({
      name,
      version: "0.1.0",
      downloadUrl: `https://static.proud-flow.example/skills/${name}-0.1.0.tgz`,
      sha256: createDeterministicSha256(name),
    })),
  };
}

function createDeterministicSha256(value: string): string {
  return Array.from({ length: 64 }, (_, index) =>
    value.charCodeAt(index % value.length).toString(16).slice(-1),
  ).join("");
}
