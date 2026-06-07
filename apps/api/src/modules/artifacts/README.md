# artifacts 模块

AI 调度和人工产生的产物管理。

## 文件

| 文件 | 职责 |
|------|------|
| `routes.ts` | 产物 CRUD + 上传路由 |
| `service.ts` | 产物业务逻辑（类型校验、版本关联） |
| `storage.ts` | 产物存储抽象（内存 / R2） |
