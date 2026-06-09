# @proud-flow/cli

Proud Flow 本地 CLI 与守护进程（Daemon）。

## 职责

- CLI 命令分发（init / status / auth / skill / daemon / Skills API helper）
- 守护进程管理（后台启动、前台阻塞、状态检查、停止、日志查看）
- WebSocket 调度连接（接收后端 dispatch 事件，启动 Codex 执行）
- Token 管理（skill / dispatcher / local 三种 token 的存储和轮换）
- Skill 安装与更新（从 CLI 内置 `skills/` 复制到工作区并校验 hash）
- 配置持久化（`~/.proud-flow/config.json`）

## 命令参考

```
proud-flow                            # 无子命令时默认前台启动 daemon
proud-flow init                       # 初始化 CLI（自动安装 Skill）
proud-flow status                     # 查看状态
proud-flow auth status/rotate/logout  # 认证管理
proud-flow skill install/update/status # Skill 管理
proud-flow daemon                     # 后台启动守护进程（启动前鉴权）
proud-flow daemon --foreground        # 前台启动（日志 stdout）
proud-flow daemon status/stop         # 守护进程管理
proud-flow daemon logs [--follow] [--lines N]  # 查看日志
proud-flow get-requirement <id>       # Skills API 辅助命令（顶层）
proud-flow get-task-context <id> [--stage <stage>]
proud-flow start-stage <id> --stage <stage>
proud-flow attach-artifact <id> --type <type> --title <title> [--url <url>]
proud-flow upload-artifact <id> --type <type> --title <title> --file <path>
proud-flow complete-stage <id> --stage <stage> [--summary <text>]
proud-flow fail-stage <id> --stage <stage> --message <text>
proud-flow append-note <id> --message <text>
proud-flow --help                     # 查看全部命令
```

## 目录结构

```
skills/                 # Skill 源文件（开发用；build 复制到 dist/package-skills/）
src/
├── bin.ts              # CLI 入口（识别 --daemon-child）
├── cli/
│   ├── run-cli.ts      # runCli 入口（Commander + exitOverride）
│   ├── program.ts      # Commander 命令注册
│   ├── output.ts       # JSON/Markdown 输出与错误格式化
│   └── clients.ts      # API client 工厂
├── commands/           # 各命令实现（init / auth / skill / daemon / skill-helpers）
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
    ├── bundled-manifest.ts  # 读取包内 manifest
    └── installer.ts         # 复制到 workspacePath/.codex/skills
```

## Skill 安装路径

`proud-flow init` 和 `proud-flow skill install` 将 Skill 安装到：

```text
{config.workspacePath}/.codex/skills/{skill-name}/
```

`workspacePath` 来自 `config.json`，默认等于 init 时的当前工作目录。

## 配置

- 配置目录：`~/.proud-flow/`（可通过 `PROUD_FLOW_CONFIG_DIR` 覆盖）
- 配置文件：`config.json`、`tokens.json`
- PID 文件：`daemon.pid`
- 日志入口：`current.log`（软链，指向当前活跃的 `daemon.N.log`）
- 日志归档：`daemon.1.log` 等（pino-pretty 可读文本 + pino-roll 滚动，10MB/文件，保留 5 个归档）

## 本地开发

```bash
pnpm build --filter @proud-flow/cli
PROUD_FLOW_API_URL=http://127.0.0.1:8787 proud-flow init --env dev --bootstrap-token <token>
pnpm test --filter @proud-flow/cli
```

## 设计文档

详见 [Proud Flow CLI Technical Design](../../docs/proud-flow-cli-technical-design.md)
