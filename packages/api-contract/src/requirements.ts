import {
  priorities,
  requirementStatuses,
  type Priority,
  type Requirement,
  type RequirementStatus,
} from "@proud-flow/domain";
import {
  arraySchema,
  enumSchema,
  numberSchema,
  objectSchema,
  optionalSchema,
  stringSchema,
  type Schema,
} from "./schema.js";

export interface CreateRequirementRequest {
  title: string;
  description: string;
  priority: Priority;
}

export interface UpdateRequirementRequest {
  title?: string;
  description?: string;
  priority?: Priority;
}

export interface RequirementResponse extends Requirement {}

export interface RequirementListResponse {
  items: RequirementResponse[];
}

export const requirementIdSchema = stringSchema({ pattern: /^REQ-\d{6}$/ });

export const requirementResponseSchema: Schema<RequirementResponse> =
  objectSchema({
    id: requirementIdSchema,
    title: stringSchema({ minLength: 1 }),
    description: stringSchema({ minLength: 1 }),
    status: enumSchema(requirementStatuses) as Schema<RequirementStatus>,
    priority: enumSchema(priorities) as Schema<Priority>,
    version: numberSchema({ integer: true, minimum: 1 }),
    createdAt: stringSchema({ minLength: 1, format: "date-time" }),
    updatedAt: stringSchema({ minLength: 1, format: "date-time" }),
  });

export const createRequirementRequestSchema: Schema<CreateRequirementRequest> =
  objectSchema({
    title: stringSchema({ minLength: 1 }),
    description: stringSchema({ minLength: 1 }),
    priority: enumSchema(priorities) as Schema<Priority>,
  });

export const updateRequirementRequestSchema: Schema<UpdateRequirementRequest> =
  objectSchema({
    title: optionalSchema(stringSchema({ minLength: 1 })),
    description: optionalSchema(stringSchema({ minLength: 1 })),
    priority: optionalSchema(enumSchema(priorities) as Schema<Priority>),
  });

export const requirementListResponseSchema: Schema<RequirementListResponse> =
  objectSchema({
    items: arraySchema(requirementResponseSchema),
  });
