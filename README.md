# AgentForge — Agent 编排平台原型

可配置的 Agent Provider + 统一运行接口，支持多模型、多编程工具协作与个人日程联动。

## 页面

| 路由 | 说明 |
|------|------|
| `/` | 平台概览、架构与设计边界 |
| `/providers` | Provider 管理（模型 API / 编程 Agent / 本地 Runtime） |
| `/agents` | Agent 配置与角色模板 |
| `/workflows` | 工作流编排、依赖与并行 |
| `/runs` | 运行监控、统一事件流、文件变更 |
| `/schedule` | 今日计划与开发任务联动 |

## 启动

```bash
cd D:\agent-orchestrator-prototype
npm install
npm run dev
```

浏览器打开 http://localhost:5173

## 核心设计

- **Orchestrator 居中**：Agent → 编排器 → Agent，不直接互调
- **Provider Adapter**：OpenAI / Claude / Gemini / Codex / OpenCode 等统一接口
- **配置驱动**：Agent、工作流、权限均由 YAML/表单配置，不写死
- **统一事件**：前端只接收标准化事件格式
