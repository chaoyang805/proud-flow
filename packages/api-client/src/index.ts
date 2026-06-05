export * from "./artifacts";
export * from "./auth";
export * from "./client";
export * from "./dispatch";
export * from "./errors";
export * from "./local";
export * from "./requirements";
export * from "./reviews";
export * from "./skills";

import { ArtifactsApiClient } from "./artifacts";
import { ProudFlowHttpClient, type ProudFlowClientOptions } from "./client";
import { DispatchApiClient } from "./dispatch";
import { LocalApiClient } from "./local";
import { RequirementsApiClient } from "./requirements";
import { ReviewsApiClient } from "./reviews";
import { SkillsApiClient } from "./skills";

export interface ProudFlowApiClient {
  requirements: RequirementsApiClient;
  reviews: ReviewsApiClient;
  artifacts: ArtifactsApiClient;
  dispatch: DispatchApiClient;
  skills: SkillsApiClient;
  local: LocalApiClient;
}

export function createProudFlowApiClient(
  options: ProudFlowClientOptions,
): ProudFlowApiClient {
  const http = new ProudFlowHttpClient(options);
  return {
    requirements: new RequirementsApiClient(http),
    reviews: new ReviewsApiClient(http),
    artifacts: new ArtifactsApiClient(http),
    dispatch: new DispatchApiClient(http),
    skills: new SkillsApiClient(http),
    local: new LocalApiClient(http),
  };
}
