# @proud-flow/config

工作区配置常量与质量任务定义。

## 职责

- 定义 monorepo workspace globs（`apps/*`、`packages/*`）
- 定义根级质量检查任务（build / typecheck / lint / test 等）
- 提供任务名校验函数

## 使用

```typescript
import { workspacePackageGlobs, rootQualityTasks } from "@proud-flow/config";
```
