# daemon 模块

CLI 守护进程核心逻辑。

## 文件

| 文件 | 职责 |
|------|------|
| `daemon.ts` | 调度协议处理（消息校验、去重、ACID 确认、Ping/Pong） |
| `child-entry.ts` | 子进程入口（WS 连接循环、消息路由、优雅关闭） |
| `verify-dispatcher-auth.ts` | 启动/重连前 dispatcher token HTTP 预检 |
| `spawn.ts` | 进程管理（后台 spawn、PID 文件读写、存活性检查） |
| `logger.ts` | pino-pretty + pino-roll 日志（`current.log` 软链） |
| `stage-router.ts` | Dispatch Stage → Codex 命令映射（tech_design → /tech-design） |
| `codex-runner.ts` | Codex 执行器抽象（Mock 实现 + CLI 实现） |

## 日志

- 后台 daemon：`pino` → `pino-pretty`（可读文本）→ `pino-roll`（按大小滚动）
- 稳定读取入口：`~/.proud-flow/current.log`（软链，滚动后自动指向最新 `daemon.N.log`）
- 勿使用遗留的 `daemon.log`（旧版曾将 stdout 重定向到该文件）；`proud-flow daemon logs` 只读 `current.log` 与 `daemon.N.log`
- 前台 daemon：日志输出到 stdout

## 启动鉴权

后台/前台启动前调用 `GET /api/dispatch/ws?token=...`，期望 HTTP 426（需 WebSocket 升级）表示 token 有效；401/403 则报错退出。
