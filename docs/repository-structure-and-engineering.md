# 仓库结构与工程化方案

## 1. 设计目标

本仓库采用 TypeScript monorepo，统一承载 Web 前端、Cloudflare Workers 后端、Proud Flow CLI / Daemon、Codex Skills、共享类型与工程工具。

核心目标：

- 前端、后端、CLI 和 Skills helper 复用同一套领域类型、状态枚举和 API schema。
- 后端是 API 与状态机的权威实现。
- 前端和 CLI 不手写重复接口类型，优先从共享 schema 或 OpenAPI 生成。
- Cloudflare 相关部署配置集中管理，prod / dev 环境清晰隔离。
- Skills 作为可发布资产纳入版本管理，由 CLI 安装和更新。
- 工程命令统一从仓库根目录执行。

## 2. 推荐技术栈

- 包管理：pnpm workspace
- 构建编排：Turborepo
- 语言：TypeScript
- 运行时：
  - Web：Next.js
  - 后端：Cloudflare Workers + Hono
  - CLI / Daemon：Node.js
- 数据库：Cloudflare D1
- ORM / SQL：Drizzle ORM 或 D1 SQL
- 校验与 schema：Zod
- API 文档：OpenAPI
- 测试：Vitest + Playwright
- 代码质量：ESLint + Prettier + TypeScript project references

## 3. 顶层目录结构

```text
proud-flow
  apps
    web                         前端 Web 工作台
    api                         Cloudflare Workers 后端
    cli                         proud-flow CLI / daemon
  packages
    domain                      领域类型、状态机常量、枚举、纯函数
    api-contract                REST 请求响应 schema、OpenAPI 生成入口
    api-client                  前端和 CLI 复用的 typed API client
    config                      tsconfig、eslint、prettier 等共享配置
    test-utils                  测试工具和 mock 数据
  skills
    tech-design                 技术方案设计 Codex Skill
    case-rundown                测试用例设计 Codex Skill
    development                 开发交付 Codex Skill
  infra
    cloudflare                  D1、R2、Workers、Pages 配置说明和脚本
  scripts                       仓库级辅助脚本
  docs                          产品与技术设计文档
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## 4. Apps 结构

### 4.1 apps/web

```text
apps/web
  app
    requirements
      page.tsx
      new/page.tsx
      [id]/page.tsx
  components
    requirements
    artifacts
    review
    realtime
    ui
  lib
    api                         使用 @proud-flow/api-client
    auth
    query
    realtime
  tests
    e2e
    components
  next.config.ts
  package.json
```

依赖规则：

- 可以依赖 `@proud-flow/domain`、`@proud-flow/api-contract`、`@proud-flow/api-client`。
- 不直接访问数据库。
- 不复制后端状态机规则，只使用共享状态常量做展示映射。
- WebSocket 事件只用于刷新提示，权威数据仍通过 REST API 获取。

### 4.2 apps/api

```text
apps/api
  src
    index.ts                    Hono 入口
    env.ts                      Cloudflare bindings 和环境校验
    middleware
      auth.ts
      error.ts
      request-id.ts
    modules
      requirements
        routes.ts
        service.ts
        repository.ts
      workflow
        state-machine.ts
        transitions.ts
      reviews
        routes.ts
        service.ts
      artifacts
        routes.ts
        service.ts
        storage.ts
      dispatch
        routes.ts
        durable-object.ts
        protocol.ts
      realtime
        routes.ts
        durable-object.ts
        events.ts
      skills-api
        routes.ts
        service.ts
      local-api
        routes.ts
        token-service.ts
        skill-manifest.ts
      auth
        token-service.ts
      db
        schema.ts
        migrations
  tests
    unit
    integration
  wrangler.toml
  package.json
```

依赖规则：

- 依赖 `@proud-flow/domain` 和 `@proud-flow/api-contract`。
- 状态流转只能从 `workflow` 模块进入。
- `skills-api`、`reviews`、`requirements` 都调用 `workflow`，不能各自改状态。
- Durable Object 只保存短时连接状态，不作为业务数据源。
- D1 schema 以 `apps/api/src/db/schema.ts` 为权威。

### 4.3 apps/cli

```text
apps/cli
  src
    index.ts                    CLI 入口
    commands
      daemon.ts
      init.ts
      status.ts
      auth.ts
      skill.ts
      api-helper.ts
    config
      environment.ts            prod / dev 固定后端地址
      local-store.ts
      keychain.ts
    client
      api-client.ts             包装 @proud-flow/api-client
      websocket.ts
    daemon
      protocol.ts
      stage-router.ts
      codex-runner.ts
      heartbeat.ts
    skills
      installer.ts
      manifest.ts
      updater.ts
    output
      markdown.ts
      json.ts
    logging
  tests
    unit
    integration
  package.json
```

依赖规则：

- 可以依赖 `@proud-flow/domain`、`@proud-flow/api-contract`、`@proud-flow/api-client`。
- 后端地址由 `config/environment.ts` 固定映射，普通用户配置不包含 `backendUrl`。
- CLI helper 不暴露 token 到 stdout。
- daemon 只接收后端下发的 `requirementId + stage`，不执行远端动态命令。

## 5. Packages 结构

### 5.1 packages/domain

保存跨端复用的纯领域定义。

```text
packages/domain
  src
    requirement.ts              Requirement、Priority、Status
    artifact.ts                 ArtifactType、Artifact
    workflow.ts                 状态、阶段、合法阶段映射
    dispatch.ts                 DispatchStage、DispatchMessage
    realtime.ts                 RealtimeEvent
    tokens.ts                   TokenType、ActorType
    errors.ts                   ErrorCode
    ids.ts                      ID 格式和 parser
  package.json
```

放在这里的内容必须满足：

- 不依赖 Hono、Next.js、Node.js、Cloudflare runtime。
- 不访问数据库。
- 不包含密钥、网络请求和 IO。
- 可以被前端、后端、CLI、测试同时引用。

### 5.2 packages/api-contract

保存 API 请求响应 schema，并生成 OpenAPI。

```text
packages/api-contract
  src
    common.ts
    requirements.ts
    reviews.ts
    artifacts.ts
    dispatch.ts
    realtime.ts
    skills.ts
    local.ts
    openapi.ts
  generated
    openapi.json
  package.json
```

建议：

- 使用 Zod 定义 request / response schema。
- 后端路由引用 schema 做运行时校验。
- 前端和 CLI 引用 schema 推导 TypeScript 类型。
- OpenAPI 从 schema 生成，不手写第二份接口文档。

### 5.3 packages/api-client

封装浏览器和 Node 都能使用的 typed API client。

```text
packages/api-client
  src
    client.ts
    errors.ts
    auth.ts
    requirements.ts
    reviews.ts
    artifacts.ts
    dispatch.ts
    skills.ts
    local.ts
  package.json
```

设计原则：

- 只负责 HTTP 请求、响应解析和错误映射。
- 不保存 token；token 由调用方注入。
- 不决定后端地址；base URL 由前端环境或 CLI environment resolver 传入。
- Web 前端只使用 user API。
- CLI helper 使用 skills API 和 local API。

### 5.4 packages/config

保存共享工程配置。

```text
packages/config
  eslint
  prettier
  tsconfig
  vitest
```

## 6. Skills 目录

```text
skills
  tech-design
    SKILL.md
    skill.json                  可选，本地安装 manifest 元数据
  case-rundown
    SKILL.md
    skill.json
  development
    SKILL.md
    skill.json
  manifest.json                 仓库内开发 manifest
```

规则：

- Skill 文档只写工作流、检查清单和如何调用 `proud-flow` 命令。
- Skill 不包含 token。
- Skill 不直接写 HTTP 请求。
- Skill 包发布时由 CLI manifest 指向打包产物。
- Skill 版本和 CLI 版本需要兼容性约束。

## 7. 类型与接口复用策略

推荐分三层：

1. `@proud-flow/domain`
   - 领域枚举、状态、错误码、事件类型。
   - 所有 app 都可依赖。

2. `@proud-flow/api-contract`
   - Zod schema + OpenAPI。
   - 后端用于入参出参校验。
   - 前端和 CLI 用于类型推导。

3. `@proud-flow/api-client`
   - 基于 contract 的 typed fetch client。
   - Web 和 CLI 复用。

示例：

```ts
// packages/domain/src/workflow.ts
export const requirementStatuses = [
  "planning",
  "tech-design",
  "tech-review",
  "case-rundown",
  "case-review",
  "developing",
  "delivery",
  "archived",
] as const;

export type RequirementStatus = (typeof requirementStatuses)[number];
```

```ts
// packages/api-contract/src/requirements.ts
import { z } from "zod";

export const createRequirementRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
});

export type CreateRequirementRequest = z.infer<
  typeof createRequirementRequestSchema
>;
```

## 8. 数据库与迁移

```text
apps/api/src/db
  schema.ts
  migrations
    0001_initial.sql
  seed.ts
```

规则：

- D1 schema 归后端 app 管理。
- `requirements` 和 `artifacts` 第一版必须建表。
- token hash 如果落库，建议使用 `api_tokens` 表。
- migrations 必须可重复在 dev D1 上执行。
- seed 只用于本地开发和测试环境。

建议脚本：

```text
pnpm db:generate
pnpm db:migrate:dev
pnpm db:migrate:prod
pnpm db:seed
```

## 9. 环境配置

### 9.1 后端环境

Cloudflare bindings：

```text
DB                  D1 database
ARTIFACT_BUCKET     R2 bucket
DISPATCH_DO         Durable Object
REALTIME_DO         Durable Object
```

敏感配置：

```text
USER_TOKEN_HASHES
BOOTSTRAP_TOKEN_HASH
TOKEN_HASH_SECRET
```

### 9.2 前端环境

```text
NEXT_PUBLIC_API_BASE_URL
```

前端 user token 第一版可由用户手动配置，后续登录化。

### 9.3 CLI 环境

普通用户不配置 `backendUrl`。

CLI 内部固定：

```text
prod -> https://api.proud-flow.example
dev  -> https://api-dev.proud-flow.example
```

开发者本地调试可临时覆盖：

```text
PROUD_FLOW_API_BASE_URL=http://localhost:8787
```

该覆盖只用于开发，不进入 `proud-flow init` 交互配置。

## 10. 根目录脚本

建议 `package.json`：

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "pnpm --filter @proud-flow/web dev",
    "dev:api": "pnpm --filter @proud-flow/api dev",
    "dev:cli": "pnpm --filter @proud-flow/cli dev",
    "build": "turbo run build",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "format": "prettier --write .",
    "openapi:generate": "pnpm --filter @proud-flow/api-contract openapi:generate"
  }
}
```

## 11. 测试分层

单元测试：

- `packages/domain`：状态机常量、阶段映射、ID parser。
- `packages/api-contract`：schema 校验。
- `apps/api`：workflow、权限、artifact 校验。
- `apps/cli`：stage-router、token 读取、环境映射、manifest 校验。
- `apps/web`：状态到操作区映射、artifact 分组。

集成测试：

- API + D1 本地测试。
- CLI helper 调用本地 API。
- daemon WebSocket ACK。
- Skill install / update。

端到端测试：

- Web 创建需求。
- Web 派发技术方案设计。
- daemon 收到派发并启动 Codex 指令 mock。
- Skill 通过 CLI helper 完成阶段。
- 前端 WebSocket 收到事件并刷新。

## 12. 发布与部署

### 12.1 后端

- `apps/api` 使用 Wrangler 部署 Workers。
- D1 migration 随部署流程执行。
- R2 bucket 和 Durable Object binding 通过 Cloudflare 配置管理。

### 12.2 前端

- `apps/web` 部署到 Cloudflare Pages 或 Workers Static Assets。
- 前端部署环境指向对应后端 API。

### 12.3 CLI

- `apps/cli` 打包为 npm package 或平台二进制。
- prod / dev 后端地址在构建时写入。
- 发布前运行 typecheck、unit test、CLI smoke test。

### 12.4 Skills

- `skills/*` 打包为 tarball。
- 上传到固定静态资源地址或 R2。
- 后端 `/api/local/skills/manifest` 返回版本、下载地址、sha256 和兼容 CLI 版本。

## 13. 命名规范

包名：

```text
@proud-flow/web
@proud-flow/api
@proud-flow/cli
@proud-flow/domain
@proud-flow/api-contract
@proud-flow/api-client
```

状态命名：

- 需求状态使用 kebab-case：`tech-review`。
- API stage 使用 snake_case：`tech_design`。
- TypeScript enum-like union 使用字符串字面量，不使用 runtime enum。

错误码：

- 使用大写 snake_case，例如 `INVALID_STATUS_TRANSITION`。

## 14. 第一版落地顺序

建议顺序：

1. 初始化 pnpm workspace、Turborepo、共享 tsconfig。
2. 建 `packages/domain`，先定义状态、stage、artifact、error、event。
3. 建 `packages/api-contract`，定义核心 REST schema。
4. 建 `apps/api`，实现 requirements、workflow、artifacts、dispatch、skills-api。
5. 建 `packages/api-client`。
6. 建 `apps/web`，实现需求列表、详情、派发和 review。
7. 建 `apps/cli`，实现 init、daemon、API helper、skill install。
8. 建 `skills/*`，接入 CLI helper。
9. 串完整 E2E 流程。

## 15. 第一版暂不做

- 多租户 monorepo 拆分。
- 独立 SDK 发布。
- GraphQL。
- tRPC 直连前后端。
- 复杂 package codegen pipeline。
- 多语言客户端。
- 多后端部署适配层。
