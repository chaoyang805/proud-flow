# @proud-flow/cli

Proud Flow 本地 CLI 与守护进程（Daemon）。

## 职责

- CLI 命令分发（init / status / auth / skill / daemon / skill-helper）
- 守护进程管理（后台启动、前台阻塞、状态检查、停止、日志查看）
- WebSocket 调度连接（接收后端 dispatch 事件，启动 Codex 执行）
- Token 管理（skill / dispatcher / local 三种 token 的存储和轮换）
- Skill 安装与更新（从后端 manifest 下载和校验）
- 配置持久化（`~/.proud-flow/config.json`）

## 命令参考

```
proud-flow init                       # 初始化 CLI
proud-flow status                     # 查看状态
proud-flow auth status/rotate/logout  # 认证管理
proud-flow skill install/update/status # Skill 管理
proud-flow daemon                     # 后台启动守护进程
proud-flow daemon --foreground        # 前台启动（日志 stdout）
proud-flow daemon status/stop         # 守护进程管理
proud-flow daemon logs [--follow] [--lines N]  # 查看日志
proud-flow skill-helper <cmd> <id>    # Skills API 辅助命令
```

## 目录结构

```
src/
├── bin.ts              # CLI 入口（识别 --daemon-child）
├── cli.ts              # 命令分发与路由
├── runtime.ts          # 运行时抽象（Node / Memory 两种实现）
├── environment.ts      # 环境判断与后端 URL
├── index.ts            # 公共导出
├── daemon/
│   ├── daemon.ts       # 调度协议处理（[README](src/daemon/README.md)）
│   ├── child-entry.ts  # 子进程入口（日志、WS 循环）
│   ├── spawn.ts        # 进程 spawn 与 PID 管理
│   ├── logger.ts       # pino 日志配置
│   ├── stage-router.ts # Dispatch Stage → Codex 命令路由
│   └── codex-runner.ts # Codex 执行器抽象
└── skills/
    └── installer.ts    # Skill 下载安装逻辑
```

## 配置

- 配置目录：`~/.proud-flow/`（可通过 `PROUD_FLOW_CONFIG_DIR` 覆盖）
- 配置文件：`config.json`、`tokens.json`
- PID 文件：`daemon.pid`
- 日志文件：`daemon.log`（pino-roll 滚动，10MB/文件，保留 5 个归档）

## 本地开发

```bash
pnpm build --filter @proud-flow/cli
PROUD_FLOW_API_URL=http://127.0.0.1:8787 proud-flow init --env dev --bootstrap-token <token>
pnpm test --filter @proud-flow/cli
```

## 设计文档

详见 [Proud Flow CLI Technical Design](../../docs/proud-flow-cli-technical-design.md)
