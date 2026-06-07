# requirements 模块

需求管理的核心模块，包含 CRUD、状态流转、D1 持久化。

## 文件

| 文件 | 职责 |
|------|------|
| `routes.ts` | REST 路由注册（GET/POST/PATCH/DELETE） |
| `service.ts` | 业务逻辑层（状态校验、版本管理） |
| `repository.ts` | 内存存储接口（本地开发用） |
| `d1-repository.ts` | D1 SQLite 存储实现（生产用） |
