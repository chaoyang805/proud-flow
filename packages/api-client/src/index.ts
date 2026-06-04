export * from "./artifacts.js";
export * from "./auth.js";
export * from "./client.js";
export * from "./dispatch.js";
export * from "./errors.js";
export * from "./local.js";
export * from "./requirements.js";
export * from "./reviews.js";
export * from "./skills.js";

import { ArtifactsApiClient } from "./artifacts.js";
import { ProudFlowHttpClient, type ProudFlowClientOptions } from "./client.js";
import { DispatchApiClient } from "./dispatch.js";
import { LocalApiClient } from "./local.js";
import { RequirementsApiClient } from "./requirements.js";
import { ReviewsApiClient } from "./reviews.js";
import { SkillsApiClient } from "./skills.js";

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
