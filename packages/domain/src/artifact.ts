export const artifactTypes = [
  "tech_design_pr",
  "case_rundown_pr",
  "case_rundown_doc",
  "development_pr",
  "test_report",
  "screenshot",
  "acceptance_record",
  "note",
] as const;

export type ArtifactType = (typeof artifactTypes)[number];

export interface Artifact {
  id: string;
  requirementId: string;
  requirementVersion: number;
  type: ArtifactType;
  title: string;
  url?: string;
  content?: string;
  createdAt: string;
}

export function isArtifactType(value: string): value is ArtifactType {
  return artifactTypes.includes(value as ArtifactType);
}
