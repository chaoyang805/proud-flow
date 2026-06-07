# daemon 模块

CLI 守护进程核心逻辑。

## 文件

| 文件 | 职责 |
|------|------|
| `daemon.ts` | 调度协议处理（消息校验、去重、ACID 确认、Ping/Pong） |
| `child-entry.ts` | 子进程入口（pino 日志、WS 连接循环、消息路由） |
| `spawn.ts` | 进程管理（后台 spawn、PID 文件读写、存活性检查） |
| `logger.ts` | pino + pino-roll 日志配置（10MB 滚动，保留 5 个归档） |
| `stage-router.ts` | Dispatch Stage → Codex 命令映射（tech_design → /tech-design） |
| `codex-runner.ts` | Codex 执行器抽象（Mock 实现 + CLI 实现） |
