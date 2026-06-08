# realtime 模块

WebSocket 实时事件推送。

## 文件

| 文件 | 职责 |
|------|------|
| `hub.ts` | 内存事件广播（单元测试 / 无 DO binding 回退） |
| `broadcast.ts` | 统一广播入口（优先 `RealtimeDurableObject`） |
| `routes.ts` | WebSocket 升级路由（代理到 DO 或内存 hub） |
