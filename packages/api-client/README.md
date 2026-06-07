# @proud-flow/api-client

类型安全的 Proud Flow API 客户端。

## 职责

- 封装 HTTP 请求（Bearer Token 注入、错误处理）
- 提供按模块分组的 API 方法（`client.requirements.create()` 等）
- 统一错误类型（`ProudFlowApiError`）
- 支持注入自定义 `fetch`（方便测试）

## 使用

```typescript
import { createProudFlowApiClient } from "@proud-flow/api-client";

const client = createProudFlowApiClient({
  baseUrl: "https://api.proud-flow.example",
  token: "pf_user_xxx",
});

const req = await client.requirements.create({ title: "新需求", priority: "high" });
```

## 模块

| 文件 | 内容 |
|------|------|
| `client.ts` | HTTP 客户端基类（`ProudFlowHttpClient`） |
| `errors.ts` | `ProudFlowApiError` 类和错误解析 |
| `auth.ts` | `TokenProvider` 接口和 `staticTokenProvider` |
| `requirements.ts` | 需求 API 方法 |
| `reviews.ts` | 审核 API 方法 |
| `artifacts.ts` | 产物 API 方法 |
| `dispatch.ts` | 调度 API 方法 |
| `skills.ts` | Skills API 方法 |
| `local.ts` | 本地 CLI API 方法（bootstrap、token 管理） |
| `index.ts` | 顶层 `createProudFlowApiClient` 工厂 + 类型导出 |
