# CareerBridge AI：DeepSeek 部署指南

当前应用的实时职业检索、报告撰写和 AI 工作台都通过 DeepSeek API 完成。当前代码不向 RunPod 发送推理请求；仓库中的 RunPod Proof of Use 是此前比赛测试留下的历史证明。

## 本地启动

需要 Node.js 20+；登录、保存档案和跨设备同步需要 PostgreSQL。

```sh
cp .env.example .env
npm install
npm start
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
npm install
npm start
```

在服务器环境设置：

- `DEEPSEEK_API_KEY`：DeepSeek API 密钥。只放在服务器密钥设置中，不要提交到 GitHub，也不要放入浏览器代码。
- `DEEPSEEK_BASE_URL`：可选，默认 `https://api.deepseek.com`。
- `DEEPSEEK_MODEL`：可选，默认 `deepseek-v4-pro`。
- `DATABASE_URL`：可选；配置 PostgreSQL 后启用账户和云端档案。
- `AI_REQUESTS_PER_HOUR`：每个账户每小时的 AI 工作台请求上限，默认 10。
- `RATE_LIMIT_PER_HOUR`：每个网络每小时的新报告上限，默认 6。

## Render 配置

1. 打开 Render Web Service 的 Environment 设置。
2. 设置 `DEEPSEEK_API_KEY`，保存后等待服务部署完成。
3. 健康检查地址为 `/api/health`；`provider` 应显示 `DeepSeek`。
4. `/api/ai/status` 显示 DeepSeek 密钥是否存在，以及账户数据库是否配置；它不代表密钥余额或上游连通性。
5. 当前 `render.yaml` 设为手动部署。更新 GitHub 后，需要在 Render 手动部署最新 commit。

若之前在 Render 保存了 `RUNPOD_API_KEY`、`RUNPOD_ENDPOINT_ID` 或 `RUNPOD_MODEL`，当前版本不会读取这些变量。可在 Environment 设置中移除这些旧项。不要把任何密钥发到聊天或公开材料中。

## 检查

运行本地检查：

```sh
npm test
```

静态站点与 `/api/health` 可在没有 API 密钥时启动；实时检索、报告和 AI 工作台需要有效且有额度的 DeepSeek API 密钥。测试不连接付费 DeepSeek 服务。

## 项目文件

- `src/server.mjs`：HTTP 服务、DeepSeek 搜索与报告。
- `src/ai-assistant.mjs`：学习计划、辅导和模拟面试请求。
- `src/ai-guards.mjs`：AI 错误和账户级请求限制。
- `src/public/`：网站页面与浏览器代码。
- `submission/RUNPOD PROOF OF USE.pdf`：此前使用 RunPod 的比赛证明；不代表当前线上版本仍调用 RunPod。
