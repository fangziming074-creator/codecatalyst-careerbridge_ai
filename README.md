# CareerBridge AI

CareerBridge AI helps students and career transitioners understand how AI and labour-market change may affect their careers, then turn that evidence into practical learning steps.

## Competition profile

- **Team:** CodeCatalyst
- **Project:** CareerBridge AI
- **Domain:** Domain 1 — AIVERSECITY
- **SDG tracks:** SDG 4 (Quality Education) and SDG 8 (Decent Work and Economic Growth), especially Targets 4.4 and 8.5
- **Team lead:** Fang Ziming
- **University:** Xiamen University Malaysia
- **Team members:** Fang Ziming, Zhu Xiaosong, Yang Qiyu, Song Haokun, and Chen Zhigu

## Links

- **Live demo:** [CareerBridge AI](https://codecatalyst-careerbridge-ai.onrender.com/)
- **Pitch video:** To be added — the team has not provided a pitch-video link yet.
- **GitHub repository:** [codecatalyst-careerbridge_ai](https://github.com/fangziming074-creator/codecatalyst-careerbridge_ai)

## The problem and our approach

The International Labour Organization reported that global youth unemployment reached **12.4% in 2025**, representing **67 million people aged 15–24**. CareerBridge AI responds with cited career outlooks and role-specific skills planning. Its readiness score compares self-reported skills with a role template; it is a planning aid, not a hiring or employment guarantee. [ILO, *Global Employment Trends for Youth 2026*](https://www.ilo.org/resource/news/youth-unemployment-rises-young-people-face-harder-road-decent-work)

The project aligns with **SDG Target 4.4**, which calls for relevant skills for employment and decent work, and **SDG Target 8.5**, which calls for productive employment and decent work for all. [UN Goal 4](https://sdgs.un.org/goals/goal4) · [UN Goal 8](https://sdgs.un.org/goals/goal8)

## What the app does

- Generates forward-looking career reports for a selected region, occupation, and time horizon, with source links.
- Presents labour-market indicators and company information to help users explore roles.
- Lets users compare their self-assessed skills with role requirements and follow a personalised learning pathway.
- Provides an authenticated AI workspace for learning-plan suggestions, tutoring, and mock-interview practice.
- Stores accounts and saved career state in PostgreSQL when a database is configured.

## How we used Replit, DeepSeek, and RunPod

- **Replit:** We used Replit, the environment provided in the SDC workshops, to prototype and orchestrate the application architecture. The production website is hosted on Render.
- **DeepSeek:** DeepSeek Search retrieves current labour-market sources through targeted searches. DeepSeek-V4-Pro synthesises those sources into cited career reports and powers the authenticated AI workspace.
- **RunPod:** We previously tested model inference on RunPod Serverless for the hackathon and retained the proof of use in [`submission/RUNPOD PROOF OF USE.pdf`](submission/RUNPOD%20PROOF%20OF%20USE.pdf). The current application runtime has migrated to DeepSeek and no longer sends AI requests to RunPod.
- **World Bank:** The app uses the World Bank World Development Indicators unemployment series (`SL.UEM.TOTL.ZS`) for macroeconomic context. [Indicator source](https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS)

## Technology

- Frontend: HTML, CSS, and JavaScript
- Application server: Node.js 20+
- Database: PostgreSQL with the `pg` driver
- Hosting: Render
- AI services: DeepSeek Search and DeepSeek-V4-Pro

## Run locally

Requirements: Node.js 20+. PostgreSQL is needed for account creation and saved-state sync.

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

Open [http://localhost:3000](http://localhost:3000). Set the server-side variables you need in `.env`:

- `DATABASE_URL` enables PostgreSQL accounts and saved-state sync.
- `DEEPSEEK_API_KEY` enables live career research, reports, and the AI workspace.
- `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL` can override the API endpoint and model; defaults are shown in `.env.example`.
- `AI_REQUESTS_PER_HOUR` limits each signed-in account’s AI workspace requests; `RATE_LIMIT_PER_HOUR` limits live reports per network.

Use `.env.example` as the variable reference. Keep real credentials in private server or Render environment settings; never commit `.env` or put keys in browser code.

Run the automated Node checks with:

```sh
npm test
```

These checks use local mocks. Passing them does not establish that paid DeepSeek services or a production database are available.

## Project structure

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
├── submission/          # Competition materials and historical RunPod proof of use
├── .env.example
├── Dockerfile
├── LICENSE
├── package.json
├── render.yaml
└── README.md
```

## Proposed Phase 2 impact target

The proposal sets a **pilot target**, not a measured result: enroll at least 20 participants; within 14 days, aim for at least 70% (14 of 20) to complete a source-cited career report, a role-specific skills assessment, and a first learning action. The team also plans to measure paired career-planning clarity on a 1–5 scale and target an average increase of at least one point. The pilot-specific baseline has not yet been collected.

