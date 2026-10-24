# CareerBridge：新仓库与 Runpod 接入

## 交付内容与边界

这是完整 Node.js + PostgreSQL 网站源码，不是只有修改过的文件。
包含主分支至 PR7 的功能、PR8 的大按钮/空输入/建档登录，以及本次 Runpod 接入。
旧 GitHub main、Render 服务和旧数据库未被修改；本包不包含密钥、账户资料、旧数据库或 node_modules。

新增 AI 工作台：学习计划建议、学习助手、文字模拟面试。
职业报告可选择使用 Runpod 写作，原有联网检索仍由 DeepSeek 执行。
AI 工作台读取当前登录账户已保存的岗位、时间及技能自报水平；不发送姓名、密码、恢复码或整个档案。
用户主动提交的问题也会发给 Runpod，请勿填写敏感信息。

学习计划建议不覆盖原有规则式学习计划；助手结果不是正式技能证据，也不改变准备度或徽章。
本版支持轻量多轮追问：同一功能在当前页保留最近 4 条消息，每条最多向模型传递 1200 字符；更早内容不会继续发送。
助手结果和对话暂存于当前页面，切换功能、切页/刷新清空，不提供持久 AI 对话历史。
原有报告仍为即时生成，不承诺持久报告历史。
这是应用功能接入，不是先前“数据隔离迁移方案”的完整实施，也没有执行历史污染清洗。

## 新 GitHub 仓库

1. 解压项目包，在 GitHub 创建新的空仓库（比赛要求 public）。
2. 上传项目目录中的全部文件；package.json、server.mjs、public、migrations 要位于仓库根目录，不要再套一层目录。
3. 确保隐藏文件 .gitignore、.env.example、.dockerignore 也上传。
4. 不要上传自己的 .env、数据库备份或 node_modules。
5. 此仓库可部署到 Render，也可作为 Node 项目导入 Replit。GitHub Pages 无法运行后端和登录数据库。

## 本地启动

需要 Node.js 20+；需要注册登录时还需 PostgreSQL。

```sh
cp .env.example .env
npm install
npm start
```

浏览器打开 http://localhost:3000。
未配置数据库/模型时，首页、静态示例、规则式功能仍能运行；对应线上账户和 AI 功能会显示未配置，不会伪造成功。
配置 DATABASE_URL 后首次启动自动执行 migrations/001_accounts.sql。新站应连接新的空数据库。
生产环境用 NODE_ENV=production 和 HTTPS，反向代理确认可信后再设置 TRUST_PROXY=1。

## Render 新服务

方式一：以新仓库创建 Blueprint，使用本包 render.yaml。**该文件会申请付费 Web Service 与数据库，先确认 Render 显示的价格和资源名，再创建。**
若资源名已存在，请先改名；绝不要选择替换旧站资源或接入旧数据库。
Blueprint 默认 autoDeploy=false，后续代码更新需要手动部署。

方式二：手动创建 PostgreSQL 和 Node Web Service：
- Build Command：npm install --omit=dev
- Start Command：npm start
- Health Check：/api/health
- NODE_ENV=production、TRUST_PROXY=1、DATABASE_URL=新库的连接信息。
- 模型变量按下一节填写；缺失时网站可启动，但对应 AI 功能不可用。

Dockerfile 是可选的通用容器部署方式，不是 Runpod GPU worker 镜像。
不要把它作为 vLLM 模型镜像上传 Runpod。

## Runpod 模型端点

1. 在 Runpod Serverless 创建 Hugging Face LLM / vLLM 端点。
2. 选择支持中英文指令和 JSON 格式输出的文本模型，GPU 显存需容纳模型及上下文。
3. 先限制最大 worker 数与账户预算；不保持 worker 常驻可减少闲置费用，但可能冷启动较慢。
4. 在网站后端环境配置：
   - RUNPOD_API_KEY：放在部署平台 Secrets，不要放浏览器/GitHub。
   - RUNPOD_ENDPOINT_ID：该 Serverless 端点 ID。
   - RUNPOD_MODEL：端点实际提供的模型名，必须精确一致。
   - RUNPOD_TIMEOUT_MS：默认 120000，上限 120000。
   - AI_REQUESTS_PER_HOUR：每账户每小时的付费尝试数，默认 10。
5. 重启网站。登录、建立并保存目标岗位后，侧边栏打开 AI 工作台。

使用固定官方接口：
https://api.runpod.ai/v2/{端点ID}/openai/v1/chat/completions
运行模型需自行创建 Runpod 账户/端点，本代码不会替你创建 GPU 或自动充值。
模型许可、区域、GPU 费用和保留政策由你在供应商处确认。

## 报告切换

- AI_PROVIDER=deepseek（默认）：原有 DeepSeek 检索及写作不变；新工作台单独使用 Runpod。
- AI_PROVIDER=runpod：DeepSeek 负责联网检索、Runpod 根据提供的来源写报告。此时真实报告要求登录。
- 两种模式的真实市场报告都需要 DEEPSEEK_API_KEY。Runpod 不是搜索引擎，单独配置 Runpod 不会获得最新市场资料。
- Runpod 报告模型必须支持 response_format=json_object 且能完整输出所需结构。若不支持，应改用兼容模型，或恢复 AI_PROVIDER=deepseek；本版不会悄悄调用另一个付费服务。
- /?view=report&sample=1 是静态示例报告，绝不调用报告/市场/GPU API。
- /api/health、/api/ai/status 仅显示配置标志；200 或 configured=true **不证明**真实模型可用或账户有余额。

## 费用、安全及限制

- 不自动重试、不自动回退付费模型。失败后由用户手动决定是否重试。
- 同一用户同时只允许一个新 AI 生成；每进程同时最多四个 Runpod 请求。
- 超时、停止等待、失败也可能已经产生供应商费用。停止等待不承诺取消 GPU 任务。
- 新 AI 工作台要求登录、同源 JSON 请求、明确 user_owned 空间和当前账户 ID。
- 个人上下文按 session 的用户 ID 从数据库读取，而非信任客户端上传的完整档案。
- Runpod 报告缓存按账户、输入、供应商和模型隔离；静态示例不调用 AI。
- 工作台输出用纯文本显示，模型返回 HTML 不会执行。
- 用量限制、运行中标记和报告缓存目前均在单个 Node 进程内。重启会重置；多实例生产部署前需升级到共享数据库/Redis 的原子额度和幂等任务，不能把这个限制当作账单硬上限。
- 当前采用同步请求；没有持久任务队列或离线恢复。冷启动超过超时会失败，不能假装生成成功。
- 登录账户的旧 JSON 状态还沿用原有存储协议；不要宣称已经完成先前的完整数据隔离重构。

## 验证

```sh
npm test
python3 tests/check-entry.py
python3 tests/check-ai.py
```

浏览器测试需要 Chromium，指定 CHROMIUM=/path/to/chromium。
自动测试使用本地模拟模型/账户，不连接真实 Runpod、DeepSeek 或生产数据库。
2026-10-24 已在 RunPod Serverless vLLM Qwen3-0.6B endpoint 完成一次控制台推理请求（request ID 见 submission/RunPod_Proof_of_Use.pdf）。这验证了 RunPod 模型服务，但不是网站端到端部署验收；网站端仍需私密配置 API key、端点变量和数据库。

官方文档：
- https://docs.runpod.io/serverless/vllm/get-started
- https://docs.runpod.io/serverless/vllm/openai-compatibility

