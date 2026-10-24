# CareerBridge AI

## Team Information

| Field | Details |
| --- | --- |
| **Team Name** | CodeCatalyst |
| **Project Name** | CareerBridge AI |
| **Team Domain** | Domain 1 — AIVERSECITY |
| **SDG Track (1–17)** | SDG 4 — Quality Education; SDG 8 — Decent Work and Economic Growth (Targets 4.4 and 8.5) |
| **Team Leader** | Fang Ziming |
| **University** | Xiamen University Malaysia |
| **Number of Members** | 5 |
| **Team Members** | Fang Ziming, Zhu Xiaosong, Yang Qiyu, Song Haokun, Chen Zhigu |

## Links

| Resource | Link |
| --- | --- |
| GitHub Repository | [codecatalyst-careerbridge_ai](https://github.com/fangziming074-creator/codecatalyst-careerbridge_ai) |
| Live Demo | [CareerBridge AI](https://codecatalyst-careerbridge-ai.onrender.com/) |
| Pitch Video | [Watch the team pitch](https://youtu.be/UXKkkAFPQa8) |

## Overview

CareerBridge AI helps students and career transitioners understand how AI and labour-market change may affect their careers, then turn that evidence into practical learning steps.

The app generates forward-looking career reports for a selected region, occupation, and time horizon, with source links. It also presents labour-market indicators and company information, compares users’ self-assessed skills with role requirements, and offers learning-plan suggestions, tutoring, and mock-interview practice.

The project aligns with **SDG Target 4.4**, which calls for relevant skills for employment and decent work, and **SDG Target 8.5**, which calls for productive employment and decent work for all. The International Labour Organization reported global youth unemployment at **12.4% in 2025**, representing **67 million people aged 15–24**. CareerBridge AI aims to respond with cited career outlooks and role-specific skills planning. Its readiness score is a planning aid, not a hiring or employment guarantee.

Sources: [ILO, Global Employment Trends for Youth 2026](https://www.ilo.org/resource/news/youth-unemployment-rises-young-people-face-harder-road-decent-work) · [UN Goal 4](https://sdgs.un.org/goals/goal4) · [UN Goal 8](https://sdgs.un.org/goals/goal8)

## How to Run the Project

### Requirements

- Node.js 20 or later
- PostgreSQL for account creation and saved-state sync

### Run locally

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
npm install
npm start
```

**macOS / Linux**

```sh
cp .env.example .env
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). Configure the server-side variables you need in `.env`:

- `DATABASE_URL` enables PostgreSQL accounts and saved-state sync.
- `DEEPSEEK_API_KEY` enables live career research, reports, and the AI workspace.
- `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL` optionally override the API endpoint and model; defaults are in `.env.example`.
- `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID`, and `RUNPOD_MODEL` configure the optional RunPod vLLM Serverless fallback. It is called only when DeepSeek text generation fails; it does not replace DeepSeek Search.
- `RUNPOD_TIMEOUT_MS` sets the maximum wait for the fallback (default 180000 ms).

Keep credentials in private server or Render environment settings. Do not commit `.env` or put API keys in browser code.

## Overall Project Structure

```text
.
├── src/                 # Node.js app source, browser assets, and SQL migrations
│   ├── server.mjs
│   ├── accounts.mjs
│   ├── ai-assistant.mjs
│   ├── report-events.mjs
│   ├── ai-guards.mjs
│   ├── public/          # HTML, CSS/JS and browser-side assets
│   └── migrations/      # PostgreSQL schema
├── docs/                # Deployment and project documentation
├── tests/               # Node tests, browser fixtures and validation scripts
├── submission/          # Competition materials and proof-of-use files
├── .env.example
├── Dockerfile
├── LICENSE
├── package.json
├── render.yaml
└── README.md
```

## How We Used Replit and RunPod

- **Replit:** Used in the SDC workshop to prototype and orchestrate the application architecture. The production website is hosted on Render.
- **RunPod:** Provides an optional vLLM Serverless fallback for text generation when DeepSeek text generation is unavailable or returns an unusable response. Normal requests use DeepSeek. RunPod does not provide source search; reports still depend on DeepSeek Search for current sources.
- **Proof of use:** The repository includes [RunPod proof of use](submission/RUNPOD%20PROOF%20OF%20USE.pdf). The team also retained [Replit proof of use](submission/REPLIT%20PROOF%20OF%20USE.pdf).

## Proposed Phase 2 Impact Target

The proposal sets a pilot target, not a measured result: enroll at least 20 participants; within 14 days, aim for at least 70% (14 of 20) to complete a source-cited career report, a role-specific skills assessment, and a first learning action. The team also plans to measure paired career-planning clarity on a 1–5 scale and target an average increase of at least one point. The pilot-specific baseline has not yet been collected.

## Technology

- Frontend: HTML, CSS, and JavaScript
- Application server: Node.js 20+
- Database: PostgreSQL with the `pg` driver
- Hosting: Render
- AI services: DeepSeek Search and DeepSeek-V4-Pro (primary); optional RunPod vLLM Serverless fallback for text generation
- Macroeconomic context: World Bank World Development Indicators unemployment series [SL.UEM.TOTL.ZS](https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS)
