import { Buffer } from "node:buffer";
import type { ArtifactType, DispatchStage } from "@proud-flow/domain";
import type { CliRuntime } from "../runtime";
import { createSkillClient } from "../cli/clients";
import { isJsonMode, json, markdown } from "../cli/output";

export interface SkillHelperOptions {
  json?: boolean;
  stage?: string;
  type?: string;
  title?: string;
  url?: string;
  content?: string;
  file?: string;
  contentType?: string;
  message?: string;
}

function requiredOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

export async function runGetRequirement(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.getRequirement(requirementId);
  return isJsonMode(options)
    ? json(payload)
    : markdown("get-requirement", payload);
}

export async function runGetTaskContext(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.getTaskContext(requirementId);
  return isJsonMode(options)
    ? json(payload)
    : markdown("get-task-context", payload);
}

export async function runStartStage(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.startStage(requirementId, {
    stage: requiredOption(options.stage, "stage") as DispatchStage,
  });
  return isJsonMode(options) ? json(payload) : markdown("start-stage", payload);
}

export async function runAttachArtifact(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.attachArtifact(requirementId, {
    type: requiredOption(options.type, "type") as ArtifactType,
    title: requiredOption(options.title, "title"),
    url: options.url,
    content: options.content,
  });
  return isJsonMode(options)
    ? json(payload)
    : markdown("attach-artifact", payload);
}

export async function runUploadArtifact(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const filePath = requiredOption(options.file, "file");
  const content = await runtime.readFile(filePath);
  const client = await createSkillClient(runtime);
  const payload = await client.skills.uploadArtifact(requirementId, {
    type: requiredOption(options.type, "type") as ArtifactType,
    title: requiredOption(options.title, "title"),
    fileName: filePath.split("/").at(-1) ?? "artifact",
    contentType: options.contentType ?? "application/octet-stream",
    contentBase64: Buffer.from(content).toString("base64"),
  });
  return isJsonMode(options)
    ? json(payload)
    : markdown("upload-artifact", payload);
}

export async function runCompleteStage(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.completeStage(requirementId, {
    stage: requiredOption(options.stage, "stage") as DispatchStage,
  });
  return isJsonMode(options)
    ? json(payload)
    : markdown("complete-stage", payload);
}

export async function runFailStage(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.failStage(requirementId, {
    stage: requiredOption(options.stage, "stage") as DispatchStage,
    message: requiredOption(options.message, "message"),
  });
  return isJsonMode(options) ? json(payload) : markdown("fail-stage", payload);
}

export async function runAppendNote(
  runtime: CliRuntime,
  requirementId: string,
  options: SkillHelperOptions,
): Promise<string> {
  const client = await createSkillClient(runtime);
  const payload = await client.skills.addNote(requirementId, {
    message: requiredOption(options.message, "message"),
  });
  return isJsonMode(options) ? json(payload) : markdown("append-note", payload);
}
