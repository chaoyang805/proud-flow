import type { SkillManifestResponse } from "@proud-flow/api-contract";

const skillManifest: SkillManifestResponse = {
  version: "0.1.0",
  cliVersionRange: ">=0.1.0",
  skills: [
    {
      name: "tech-design",
      version: "0.1.0",
      downloadUrl:
        "https://static.proud-flow.example/skills/tech-design-0.1.0.skillpkg.json",
      sha256:
        "01bd4cd43b816133616f9ebf9acf24b46a85fb6df4dcff24831129904493f200",
    },
    {
      name: "case-rundown",
      version: "0.1.0",
      downloadUrl:
        "https://static.proud-flow.example/skills/case-rundown-0.1.0.skillpkg.json",
      sha256:
        "a08c83cc694bb7dcd4e9def0af2da3a4d2a27dfc63153ddfdc73f022bce1d1db",
    },
    {
      name: "development",
      version: "0.1.0",
      downloadUrl:
        "https://static.proud-flow.example/skills/development-0.1.0.skillpkg.json",
      sha256:
        "fc78bac7cb1726cb3fec723054366dd87e798d0128743b43a5f5d87e99239ca8",
    },
  ],
};

export function createSkillManifest(): SkillManifestResponse {
  return skillManifest;
}
