# @proud-flow/domain

共享领域类型与校验函数，前后端和 CLI 共用。

## 职责

- 定义核心领域类型（需求、工作流、产物、调度、Token）
- 提供类型守卫函数（`isRequirementStatus`、`isDispatchStage` 等）
- 定义 ID 格式规范与解析
- 定义错误码枚举

## 模块

| 文件 | 内容 |
|------|------|
| `requirement.ts` | `Requirement` 类型、状态枚举、优先级枚举、守卫函数 |
| `workflow.ts` | 状态流转映射、审核状态、必填产物、流转检查 |
| `artifact.ts` | `Artifact` 类型、产物类型枚举、守卫函数 |
| `dispatch.ts` | `DispatchStage` 枚举、调度消息类型、ACID 消息 |
| `tokens.ts` | `TokenType`、`ActorType` 枚举及守卫函数 |
| `errors.ts` | `ErrorCode` 枚举及守卫函数 |
| `ids.ts` | ID 格式正则（REQ-XXXXXX 等）、`parseId` 函数 |
| `realtime.ts` | WebSocket 实时事件类型定义 |

## 使用

```typescript
import { isRequirementStatus, type RequirementStatus } from "@proud-flow/domain";
if (isRequirementStatus(value)) { /* value 类型收窄为 RequirementStatus */ }
```
