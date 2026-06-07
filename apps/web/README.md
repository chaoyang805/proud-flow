# @proud-flow/web

Next.js 前端需求管理工作台。

## 职责

- 需求列表与详情展示
- 需求创建与编辑
- 人工审核操作（通过/驳回/回滚）
- AI 产物查看（按版本分组）
- 实时事件通知（WebSocket Toast）
- Token 管理（用户前端 Token 输入和存储）

## 技术栈

- **框架**：Next.js (App Router)
- **UI**：React + Tailwind CSS
- **数据获取**：TanStack Query
- **实时通信**：WebSocket（通过 `lib/realtime`）
- **测试**：Vitest + Testing Library + jsdom

## 目录结构

```
src/
├── app/                      # Next.js App Router 页面
│   ├── layout.tsx            # 根布局
│   ├── page.tsx              # 首页
│   └── requirements/         # 需求页面
│       ├── page.tsx          # 需求列表
│       ├── new/page.tsx      # 创建需求
│       └── [id]/page.tsx     # 需求详情
├── components/
│   ├── artifacts/            # 产物组件
│   ├── auth/                 # Token 守卫组件
│   ├── realtime/             # 实时通知组件
│   ├── requirements/         # 需求工作台组件
│   └── review/               # 审核操作面板
└── lib/
    ├── api/                  # API 客户端
    ├── auth/                 # Token 存储
    ├── query/                # TanStack Query 配置
    ├── realtime/             # WebSocket 事件
    └── requirements/         # 需求标签映射
```

## 本地开发

```bash
pnpm dev:web    # 启动 Next.js dev server
pnpm test --filter @proud-flow/web
```

## 设计文档

详见 [Frontend Technical Design](../../docs/frontend-technical-design.md)
