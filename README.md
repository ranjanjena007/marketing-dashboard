# Q3 2024 Marketing Analytics Dashboard

A full-stack Node.js web application that presents **Q3 2024 marketing campaign data** through interactive dashboards and integrates an **IBM watsonx.ai chatbot** for natural-language data queries.

## Features

| Feature | Details |
|---|---|
| **Overview Dashboard** | KPI cards, Revenue vs Spend by channel, Status pie, Monthly trend, Campaign type ROI |
| **Channel Performance** | ROI bars, CTR bars, Conversion rate pie, Budget/Spend/Revenue grouped bars, channel scorecards |
| **Campaign Explorer** | Filterable/sortable table of all 50 campaigns (channel, status, search, sort by ROI/revenue) |
| **Performance Insights** | Top-5/Bottom-5 ROI bar, Revenue by type pie, Spend vs Revenue scatter with conversion bubbles, key insights panel |
| **AI Assistant** | watsonx.ai-powered chatbot with full campaign data context — answers any question about the Q3 data |

## Tech Stack

- **Backend**: Node.js (ESM) + Express 4
- **Frontend**: Vanilla JS + [Apache ECharts 5](https://echarts.apache.org/)
- **AI**: IBM watsonx.ai (`/ml/v1/text/chat`) with IAM token auth
- **Data**: Pre-extracted from `Q3_2024_Marketing_Campaigns.xlsx` (50 campaigns, 15 metrics)

## Project Structure

```
marketing-dashboard/
├── server.js           # Express server entry point
├── config.env          # Environment variables (watsonx credentials)
├── package.json
├── routes/
│   ├── api.js          # REST API endpoints (/api/*)
│   └── chat.js         # watsonx.ai chat proxy (/api/chat)
├── src/
│   └── data.js         # All campaign data + computed aggregations
└── public/
    ├── index.html      # Single-page app shell
    ├── css/style.css   # Full responsive stylesheet
    └── js/app.js       # ECharts rendering, filters, chatbot UI
```

## Getting Started

### Prerequisites
- Node.js ≥ 18
- IBM watsonx.ai credentials (pre-configured in `config.env`)

### Install & Run

```bash
cd marketing-dashboard
npm install
npm start
```

Open **http://localhost:3000** in your browser.

For live-reload during development:
```bash
npm run dev
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/kpis` | Aggregate KPIs (totals, averages) |
| GET | `/api/campaigns` | All 50 campaigns — supports `?channel=&status=&sort=` |
| GET | `/api/channel-stats` | Per-channel aggregates |
| GET | `/api/status-breakdown` | Active / Paused / Completed counts |
| GET | `/api/type-stats` | Per campaign-type aggregates |
| GET | `/api/monthly-trend` | Monthly spend & revenue |
| GET | `/api/top-performers` | Top 5 + Bottom 5 by ROI |
| POST | `/api/chat` | watsonx.ai chat proxy — body: `{ messages: [{role, content}] }` |

## Environment Variables (`config.env`)

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default: 3000) |
| `WATSONX_URL` | watsonx.ai inference endpoint |
| `WATSONX_API_KEY` | IBM Cloud API key |
| `WATSONX_PROJECT_ID` | watsonx.ai project ID |
| `WATSONX_MODEL_ID` | Model ID (e.g. `openai/gpt-oss-120b`) |

## Data Summary (Q3 2024)

| Metric | Value |
|---|---|
| Total Campaigns | 50 |
| Total Budget | $1,323,804 |
| Total Spend | $1,145,351 |
| Total Revenue | $2,193,346 |
| Avg ROI | 131.89% |
| Avg CTR | 4.05% |
| Best Channel (ROI) | Search Ads (+275.37%) |
| Worst Channel (ROI) | Display Ads (-60.69%) |

---

## Deployment — IBM Code Engine via GitHub Actions

The repository ships with a three-job CI/CD pipeline (`.github/workflows/deploy.yml`) that runs on every push to `main`.

```
push to main
     │
     ▼
┌─────────────┐    ┌──────────────────────┐    ┌────────────────────────┐
│  1. test    │───▶│  2. build-push       │───▶│  3. deploy             │
│  npm ci     │    │  docker build        │    │  ibmcloud ce app       │
│  smoke test │    │  push → ICR (us.icr) │    │  create / update       │
└─────────────┘    └──────────────────────┘    └────────────────────────┘
```

### One-time Setup

#### Step 1 — Create a GitHub Repository and push the code

```bash
cd marketing-dashboard
git init
git add .
git commit -m "feat: initial marketing dashboard"

# Create repo on GitHub, then:
git remote add origin https://github.com/<your-org>/<your-repo>.git
git branch -M main
git push -u origin main
```

#### Step 2 — Set up IBM Container Registry namespace

```bash
# Login
ibmcloud login --apikey <YOUR_IBM_CLOUD_API_KEY> -r us-south

# Install Container Registry plugin (if not already installed)
ibmcloud plugin install container-registry

# Create a namespace
ibmcloud cr namespace-add <your-namespace>

# Create an ICR pull secret for Code Engine
ibmcloud ce registry create \
  --name icr-secret \
  --server us.icr.io \
  --username iamapikey \
  --password <YOUR_IBM_CLOUD_API_KEY>
```

#### Step 3 — Create an IBM Code Engine project

```bash
ibmcloud plugin install code-engine

ibmcloud ce project create --name marketing-dashboard-project

# Get the project ID (GUID) — copy it for the GitHub secret
ibmcloud ce project get --name marketing-dashboard-project
```

#### Step 4 — Add GitHub Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name | Value |
|---|---|
| `IBM_CLOUD_API_KEY` | Your IBM Cloud IAM API key |
| `ICR_NAMESPACE` | Container Registry namespace (e.g. `my-org`) |
| `CE_PROJECT_ID` | Code Engine project GUID |
| `CE_APP_NAME` | App name in Code Engine (e.g. `marketing-dashboard`) |
| `CE_REGION` | IBM Cloud region (e.g. `us-south`) |
| `CE_RESOURCE_GROUP` | IBM Cloud resource group name (e.g. `itz-wxo-6a38d777316a5cae0b274f`) |
| `WATSONX_API_KEY` | watsonx.ai API key |
| `WATSONX_PROJECT_ID` | watsonx.ai project ID |
| `WATSONX_URL` | watsonx.ai endpoint URL |
| `WATSONX_MODEL_ID` | Model ID (e.g. `openai/gpt-oss-120b`) |

#### Step 5 — Push and watch the pipeline

```bash
git push origin main
```

Go to **GitHub repo → Actions** to watch the pipeline run. The final step prints the live URL in the **Deployment Summary**.

### Pipeline Jobs

| Job | Trigger | What it does |
|---|---|---|
| `test` | Every PR + push | `npm ci`, starts server, validates HTTP 200 |
| `build-push` | Push to `main` only | Builds Docker image, tags with short SHA + `latest`, pushes to ICR |
| `deploy` | Push to `main` only | Creates or updates Code Engine application with new image + env vars |

### Docker Image

The `Dockerfile` uses a two-stage build:
- **Stage 1 (`deps`)**: installs only production dependencies via `npm ci --omit=dev`
- **Stage 2 (`runner`)**: copies the minimal runtime artefacts, runs as a non-root user

Watsonx credentials are **never baked into the image** — they are injected as environment variables by Code Engine at runtime.

### Scaling

The pipeline deploys with `--min-scale 1 --max-scale 3 --cpu 0.5 --memory 1G`.  
Adjust these flags in `deploy.yml` to match your workload.

# updated for testing github actions
