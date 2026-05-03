# TokenOptimizer

TokenOptimizer is a full-stack web application for estimating LLM usage cost before running a prompt. It helps builders compare model economics, understand prompt and attachment token impact, and get cheaper model/prompt recommendations before sending work to an LLM.

The app is built as a monorepo with a React frontend, an Express backend, and an importable n8n workflow. The frontend counts prompt and attachment input tokens locally. The backend proxies analysis requests to n8n and fetches the public OpenRouter model catalog, keeping private webhook URLs and API credentials out of the browser bundle.

Use TokenOptimizer when you want to:

- Check expected LLM cost before running a prompt-heavy task
- Compare model pricing across Text, File, Image, Audio, and Video output modalities
- Estimate local attachment token impact without uploading file contents
- Generate model-specific prompt optimization guidance
- Keep vendor keys and webhook URLs in server-side configuration

## Features

- Live prompt token counting with `tiktoken`
- Searchable OpenRouter model catalog
- Input and output price display per 1K tokens
- Modality-first output goal selection for Text, File, Image, Audio, and Video estimates
- Local attachment estimation for text files, PDFs, images, media, and generic files without sending file bytes to the backend
- Backend proxy to an n8n webhook for low-cost estimates
- Cost estimate dashboard with loading, success, empty, and error states
- Top 5 cost-optimized model recommendations
- Per-model optimized prompt output with token and cost deltas
- Copy optimized prompt and use recommended model plus prompt from the UI

## Tech Stack

Frontend:

- React
- Vite
- Tailwind CSS
- lucide-react
- tiktoken
- pdfjs-dist

Backend:

- Node.js
- Express
- node-fetch
- cors
- dotenv

External services:

- n8n webhook workflow
- OpenRouter model catalog and estimator model calls through n8n

## Project Structure

```text
token-optimizer/
  frontend/
    src/
    package.json
    vite.config.js
    tailwind.config.js
    .env.example
  backend/
    src/
    server.js
    package.json
    .env.example
  dev/
    mock-webhook.cjs
    static-server.cjs
  n8n/
    TokenOptimizer Workflow.json
  README.md
```

## Prerequisites

Install these before running the project:

- Node.js 18 or newer
- npm
- A running n8n workflow with a production webhook URL
- An OpenRouter API key configured inside n8n if your workflow calls OpenRouter
- Git, if you plan to push the project to GitHub

Recommended local ports:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Optional mock webhook: `http://localhost:3001`

## Environment Variables

Sensitive values are intentionally configured outside the committed source code.
Do not commit `backend/.env`, `frontend/.env`, OpenRouter API keys, n8n credential exports, access tokens, or private webhook URLs.

Create your backend environment file:

```bash
cd token-optimizer/backend
cp .env.example .env
```

On Windows PowerShell:

```powershell
cd token-optimizer/backend
Copy-Item .env.example .env
```

Backend `.env`:

```env
PORT=3000
N8N_WEBHOOK_URL=https://your-n8n-domain.example/webhook/token-optimizer
N8N_TIMEOUT_MS=30000
CLIENT_ORIGIN=http://localhost:5173
```

Variable notes:

- `PORT`: backend port.
- `N8N_WEBHOOK_URL`: your production n8n webhook that receives analysis payloads. Replace the example host with your own n8n Cloud or self-hosted domain.
- `N8N_TIMEOUT_MS`: timeout for the backend-to-n8n request.
- `CLIENT_ORIGIN`: comma-separated allowed frontend origins for CORS.

Create your frontend environment file if you want to override the default backend URL:

```bash
cd token-optimizer/frontend
cp .env.example .env
```

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

The frontend does not need API keys. Keep OpenRouter credentials inside n8n and keep the n8n webhook URL in the backend only.

## Fork Setup Checklist

If you fork this repository:

1. Import `n8n/TokenOptimizer Workflow.json` into your own n8n workspace.
2. Create or select your own OpenRouter credential inside n8n.
3. Activate the workflow and copy its production webhook URL.
4. Create `backend/.env` from `backend/.env.example`.
5. Set `N8N_WEBHOOK_URL` to your own webhook URL.
6. Set `CLIENT_ORIGIN` to your frontend URL, such as `http://localhost:5173` locally.
7. Create `frontend/.env` from `frontend/.env.example` only if your backend is not running at `http://localhost:3000`.
8. Run `git status --short` before pushing and confirm no `.env`, logs, `node_modules`, or `dist` files are staged.

Example backend configuration for a fork:

```env
PORT=3000
N8N_WEBHOOK_URL=https://your-n8n-domain.example/webhook/token-optimizer
N8N_TIMEOUT_MS=30000
CLIENT_ORIGIN=http://localhost:5173
```

Example production frontend configuration:

```env
VITE_API_BASE_URL=https://your-backend-domain.example
```

## Installation

Install backend dependencies:

```bash
cd token-optimizer/backend
npm install
```

Install frontend dependencies:

```bash
cd token-optimizer/frontend
npm install
```

## Running Locally

Start the backend:

```bash
cd token-optimizer/backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd token-optimizer/frontend
npm run dev
```

Open the app:

```text
http://localhost:5173
```

## Optional Mock Webhook

Use the mock webhook when your n8n workflow is unavailable and you only want to test the app UI and backend contract.

Start the mock webhook:

```bash
cd token-optimizer
node dev/mock-webhook.cjs
```

Point the backend `.env` to the mock:

```env
N8N_WEBHOOK_URL=http://127.0.0.1:3001/
```

Restart the backend after changing `.env`.

## API Overview

### Health Check

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

### Model Catalog

```http
GET /api/models
```

Returns normalized OpenRouter model metadata used by the frontend selector.

### Analyze Prompt

```http
POST /api/analyze
```

Request:

```json
{
  "prompt": "Build a dashboard for tracking SaaS costs.",
  "model": "google/gemini-2.5-flash",
  "intent": "Text",
  "output_type": "Text",
  "input_tokens": 45,
  "prompt_tokens": 35,
  "attachment_tokens": 10,
  "input_attachments": [
    {
      "type": "document",
      "name": "brief.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 5242880,
      "pages": 4,
      "token_estimate": 10,
      "confidence": "high",
      "method": "pdf_text_extraction"
    }
  ],
  "input_price": 0.000075,
  "output_price": 0.0003,
  "candidate_models": [
    {
      "id": "google/gemini-2.5-flash",
      "name": "Google: Gemini 2.5 Flash",
      "input_price": 0.0003,
      "output_price": 0.0025,
      "context_length": 1048576,
      "input_modalities": ["text"],
      "output_modalities": ["text"]
    }
  ]
}
```

Base success response:

```json
{
  "input_tokens": 45,
  "predicted_output": 300,
  "estimated_cost": 0.0012,
  "optimization_tip": "Recommended mode: Structured text and code planning..."
}
```

Input attachment notes:

- Text-like files are read locally and counted with `tiktoken`.
- PDFs are parsed in the browser with `pdfjs-dist`; extracted text is counted with `tiktoken`.
- Scanned PDFs with no extractable text use a local page-count fallback.
- Images use local dimensions and a tile-based token estimate.
- Audio, video, office documents, archives, and unknown binary files use a low-confidence size-based estimate.
- File bytes and extracted text are not sent to the backend or n8n; only metadata and token estimates are included.

Recommendation notes:

- Recommendations compare available catalog models by estimated cost, savings, confidence, and prompt strategy.
- The selected output modality shapes the prompt strategy and labels, but recommendations are not hidden solely because catalog modality metadata is missing or incomplete.

The backend may also include recommendation fields such as:

```json
{
  "recommended_mode": "Text generation",
  "recommended_intent": "Text",
  "optimized_prompt": "Objective: Build a dashboard...",
  "optimization_recommendations": [
    {
      "model": "Example Model",
      "model_id": "provider/model-id",
      "mode": "Structured text and code planning",
      "estimated_cost": 0.0004,
      "savings_percent": 75,
      "confidence_score": 0.72,
      "accuracy": "Medium",
      "prompt_strategy": "Implementation prompt with requirements, constraints, and acceptance checks",
      "optimized_prompt": "Objective: Build a dashboard...",
      "optimized_input_tokens": 92,
      "optimized_token_change": -13,
      "optimized_estimated_cost": 0.0003,
      "optimized_cost_change": -0.0001,
      "changes_made": [
        "Separated objective, context, constraints, and output format."
      ]
    }
  ]
}
```

Error response:

```json
{
  "error": "message"
}
```

## n8n Workflow

An importable workflow file is included at:

```text
n8n/TokenOptimizer Workflow.json
```

The checked-in workflow is a safe import template. It is intentionally inactive
and does not include exported n8n workflow IDs, webhook IDs, or bound credential
IDs/names.

After importing it into n8n:

1. Configure or rebind your OpenRouter credential in n8n.
2. Confirm the webhook path is `token-optimizer`.
3. Activate the workflow for production use.
4. Use the production webhook URL in `backend/.env`.

Do not commit n8n credential exports, private webhook URLs, or workflow exports
that include instance-specific IDs. Keep OpenRouter keys inside n8n credentials.

The backend expects n8n to return:

```json
{
  "input_tokens": 45,
  "predicted_output": 300,
  "estimated_cost": 0.0012,
  "optimization_tip": "A useful optimization suggestion."
}
```

## Production Notes

- Keep all API keys and webhook URLs in backend environment variables.
- Do not expose OpenRouter keys in the frontend.
- Set `CLIENT_ORIGIN` to your deployed frontend URL.
- Set `VITE_API_BASE_URL` to your deployed backend URL before building the frontend.
- Use the n8n production webhook path, not the test webhook path, for deployed use.

Build the frontend:

```bash
cd token-optimizer/frontend
npm run build
```

Run the backend in production mode:

```bash
cd token-optimizer/backend
npm run start
```

## GitHub Push Guide

From the `token-optimizer` folder:

```bash
git init
git add .
git commit -m "Initial TokenOptimizer app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before pushing:

- Confirm `.env` files are not staged.
- Confirm `node_modules/` and `dist/` are not staged.
- Confirm runtime logs are not staged.
- Review `backend/.env.example` and `frontend/.env.example` so other developers know what to configure.

Useful check:

```bash
git status --short
```

## Troubleshooting

If the frontend cannot load models:

- Confirm the backend is running on `http://localhost:3000`.
- Confirm `VITE_API_BASE_URL` points to the backend.
- Check `GET http://localhost:3000/api/health`.

If analysis fails:

- Confirm `N8N_WEBHOOK_URL` is a production webhook URL.
- Confirm the n8n workflow is active.
- Confirm the n8n workflow returns valid JSON with the four required fields.
- Increase `N8N_TIMEOUT_MS` if your estimator model is slow.

If CORS fails:

- Confirm `CLIENT_ORIGIN=http://localhost:5173` for local development.
- For production, set `CLIENT_ORIGIN` to your deployed frontend URL.

## License

No license has been selected yet. Add a `LICENSE` file before publishing if this repository should be open source.
