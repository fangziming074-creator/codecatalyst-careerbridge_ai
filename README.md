# CareerBridge AI

CareerBridge AI helps people explore career options, compare labor-market signals, and build a skills-based learning path. The project combines a Node.js web app, PostgreSQL-backed accounts, DeepSeek-powered web research, and optional RunPod-hosted language-model features.

## Competition submission

- Team name: codecatalyst
- Project name: CareerBridge AI (careerbridge_ai)
- Domain / SDG track: to be confirmed by the team
- Team lead: Fang Ziming
- University: Xiamen University Malaysia
- Team members (5): Fang Ziming, Zhu Xiaosong, Yang Qiyu, Song Haokun, and Chen Zhigu
- Premium sponsor technology: RunPod Serverless (vLLM). A direct console inference request completed; the app-side RunPod adapter is included in `runpod.mjs`.
- Live site: https://codecatalyst-careerbridge-ai.onrender.com/; demo and pitch links: to be added when available

The competition materials require a public GitHub repository, source code, this README, an Apache 2.0 license, and a `submission/` folder containing the completed proposal and genuine platform proof. Add those materials only after they exist. Do not present sample or placeholder files as proof.

## Features

- Generate cited career trend reports from a region, occupation, and time horizon. DeepSeek provides live web research; when configured, RunPod can write the report from those sources.
- Explore labor-market indicators and company suggestions.
- Create an account and sync profile, skills, learning path, saved roles, and badges across devices using PostgreSQL.
- Use optional AI learning assistance and interview practice with a configured RunPod endpoint.

## Run locally

Requirements: Node.js 20+ and, for account sync, PostgreSQL.

```sh
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`. Set `DATABASE_URL` to enable accounts. Set `DEEPSEEK_API_KEY` for live career research. For RunPod features, set `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, and `RUNPOD_MODEL` in the server environment. Never put real keys in GitHub or browser-side code.

`AI_PROVIDER=deepseek` keeps DeepSeek as the report writer. `AI_PROVIDER=runpod` uses DeepSeek for web research and RunPod for report writing. RunPod alone does not perform the live web search required for career reports.

## Deployment

The web application is a Node service; RunPod is used as a model-inference endpoint, not as the web host. The current Render preview uses free web and Postgres tiers; the free database expires after 30 days, and the free web service can sleep when idle. Do not connect a production site to an old database.

See [RunPod deployment guide](RUNPOD-部署指南.md) for endpoint setup, environment variables, limits, and cost considerations. A genuine RunPod console request completed on 2026-10-24; see `submission/RunPod_Proof_of_Use.pdf`. App-side end-to-end use still requires private server credentials and a live web/database deployment.

## Project layout

- `server.mjs`, `runpod.mjs`, `ai-assistant.mjs`: Node server and AI integrations
- `public/`: website UI
- `migrations/`: PostgreSQL schema migrations
- `tests/` and `*.test.mjs`: automated checks
- `submission/`: competition documents and genuine proof of use

## Checks

```sh
npm test
```

Automated tests use mocks and do not prove that a live RunPod endpoint, DeepSeek account, hosted site, or production database works.
