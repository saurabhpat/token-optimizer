# TokenOptimizer

TokenOptimizer is a full-stack web application for estimating LLM usage cost before running a prompt. It helps builders understand prompt size, attachment token impact, output-token risk, reasoning-mode overhead, and cheaper model or prompt alternatives before spending credits.

The app is built as a monorepo with a React frontend and an Express backend. The frontend counts prompt and attachment input tokens locally. The backend fetches the live OpenRouter model catalog and performs backend-native estimation with deterministic fallback, so the app remains usable even when optional OpenRouter estimator calls are unavailable.

TokenOptimizer is an estimator and decision-support tool. It does not guarantee exact provider billing and does not run the selected model as part of the main estimate flow.

## What It Does

- Counts prompt tokens locally with `tiktoken`.
- Estimates attachment token impact locally without uploading file bytes.
- Loads live OpenRouter model names, modality metadata, and pricing.
- Infers likely output type from the prompt instead of requiring a manual goal selector.
- Accepts an optional free-text reasoning mode such as `Fast`, `Pro`, `Thinking`, `Adaptive Thinking`, or `budget_tokens=2048`.
- Estimates visible output tokens, reasoning/thinking token overhead, total billable output tokens, and total cost.
- Recommends cheaper model and reasoning-mode alternatives.
- Produces optimized prompt variants with token and cost deltas.

## Product Documentation

- [TOKENOPTIMIZER_PRD.md](./TOKENOPTIMIZER_PRD.md): full product requirements document covering problem, solution, model architecture, prompts, guardrails, evals, success metrics, GTM, and monetization options.
- [PRODUCT_ONE_PAGER.md](./PRODUCT_ONE_PAGER.md): concise product brief for quick review.
- [Render_deployment.md](./Render_deployment.md): step-by-step Render deployment guide.

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

- OpenRouter public model catalog
- Optional OpenRouter estimator call from the backend

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
  n8n/
    TokenOptimizer Workflow.json
  PRODUCT_ONE_PAGER.md
  TOKENOPTIMIZER_PRD.md
  Render_deployment.md
  README.md
```

The `n8n/` folder is retained as a legacy reference template. The main app no longer requires n8n to run.

## Prerequisites

- Node.js 18 or newer
- npm
- Git
- Optional: an OpenRouter API key if you want the backend to call an estimator model

Recommended local ports:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Environment Variables

Sensitive values are intentionally configured outside committed source code. Do not commit `.env` files, OpenRouter API keys, access tokens, logs, `node_modules`, or build output.

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
CLIENT_ORIGIN=http://localhost:5173
OPENROUTER_API_KEY=
OPENROUTER_ESTIMATOR_MODEL=openrouter/free
OPENROUTER_TIMEOUT_MS=25000
```

Variable notes:

- `PORT`: backend port.
- `CLIENT_ORIGIN`: comma-separated allowed frontend origins for CORS.
- `OPENROUTER_API_KEY`: optional. When present, the backend can call OpenRouter for structured estimation.
- `OPENROUTER_ESTIMATOR_MODEL`: optional estimator model. Defaults to `openrouter/free`.
- `OPENROUTER_TIMEOUT_MS`: timeout for optional estimator calls.

Create your frontend environment file only if you want to override the default backend URL:

```bash
cd token-optimizer/frontend
cp .env.example .env
```

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
```

The frontend never needs API keys.

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

Open:

```text
http://localhost:5173
```

## API Overview

### `GET /api/health`

Returns:

```json
{ "status": "ok" }
```

### `GET /api/models`

Returns OpenRouter catalog data normalized for the frontend:

```json
{
  "data": [
    {
      "id": "openai/gpt-4o-mini",
      "name": "OpenAI: GPT-4o-mini",
      "input_price": 0.0015,
      "output_price": 0.002,
      "input_modalities": ["text"],
      "output_modalities": ["text"],
      "context_length": 128000
    }
  ]
}
```

### `POST /api/analyze`

Required payload fields:

```json
{
  "prompt": "Create a concise app plan...",
  "model": "openai/gpt-4o-mini",
  "input_tokens": 120,
  "prompt_tokens": 120,
  "attachment_tokens": 0,
  "input_attachments": [],
  "input_price": 0.0015,
  "output_price": 0.002
}
```

Optional field:

```json
{
  "reasoning_mode": "Pro"
}
```

Success response keeps the stable contract:

```json
{
  "input_tokens": 120,
  "predicted_output": 900,
  "estimated_cost": 0.00198,
  "optimization_tip": "..."
}
```

Additional optional fields may include:

- `output_type`
- `artifact_type`
- `visible_output_tokens`
- `reasoning_token_estimate`
- `reasoning_mode_label`
- `recommended_reasoning_mode`
- `reasoning_mode_rationale`
- `mode_cost_delta`
- `optimization_recommendations`

## Reasoning Mode Input

The reasoning mode textbox is optional estimation metadata. It does not guarantee a provider execution setting; it helps TokenOptimizer estimate how much extra thinking or reasoning overhead a prompt may incur.

Examples:

- `Fast`
- `low`
- `Balanced`
- `Thinking`
- `Adaptive Thinking`
- `Pro`
- `high`
- `budget_tokens=2048`

If left empty, the backend uses `Standard` mode. This avoids silently upgrading the user into a higher-cost thinking mode unless they explicitly ask for it.

## How The Estimate Works

TokenOptimizer separates the estimate into plain-language parts:

- `Prompt + file tokens`: input size counted or estimated locally.
- `Estimated Output Tokens`: the answer size the user is likely to see.
- `Thinking mode cost`: estimated extra reasoning tokens from modes such as Thinking, Pro, or custom token budgets.
- `Total output tokens`: estimated answer tokens plus thinking tokens.
- `Estimated price`: input cost plus output cost using the selected model prices.

For text-like outputs, the main formula is:

```text
Estimated price =
input tokens x input price / 1,000
+ total output tokens x output price / 1,000
```

For image, audio, and video-style outputs, TokenOptimizer uses the input-token cost plus a modality-aware output estimate rather than pretending every output behaves like normal text.

## Attachment Estimation

Attachments stay local in the browser. The frontend sends only metadata and token estimates to the backend.

- Text-like files are counted from local text extraction.
- PDFs use local text extraction when available.
- Scanned PDFs use page-count fallback.
- Images use dimensions and a tile estimate.
- Other file types use a low-confidence size-based estimate.

## Production Deployment

The recommended free-friendly deployment path is Render:

- Render Static Site for the frontend.
- Render Web Service for the backend.
- OpenRouter key stored only in backend environment variables if estimator calls are enabled.

See [Render_deployment.md](./Render_deployment.md) for the full deployment guide.

## Legacy n8n Workflow

`n8n/TokenOptimizer Workflow.json` is retained as a legacy import template from earlier versions of the project. It should not contain private workflow IDs, webhook IDs, credential IDs, API keys, or private webhook URLs.

The current app does not require n8n. Do not configure `N8N_WEBHOOK_URL` for the main backend unless you are experimenting with the legacy workflow yourself.

## Security Notes

- Never expose API keys in the frontend.
- Do not commit `.env` files.
- Do not commit OpenRouter keys, authorization tokens, private webhook URLs, logs, `node_modules`, or `dist`.
- Backend CORS should include only trusted frontend origins.
- File bytes and extracted attachment text are not sent to the backend.

## Useful Commands

Frontend build:

```bash
cd token-optimizer/frontend
npm run build
```

Backend start:

```bash
cd token-optimizer/backend
npm run start
```

Backend syntax check:

```bash
cd token-optimizer/backend
node --check server.js
```
