# TokenOptimizer Render Deployment Guide

This guide explains how to deploy TokenOptimizer on Render with GitHub as the source repository, Render hosting both app services, and the Express backend performing backend-native cost estimation.

Production architecture:

```text
Browser
  -> Render Static Site: React frontend
  -> Render Web Service: Express backend
  -> OpenRouter public model catalog
  -> Optional OpenRouter estimator call from backend
  -> Optional OpenRouter quality sweep and judge calls from backend
```

The current app no longer requires n8n for the live analysis path. The `n8n/` folder remains only as a legacy workflow template.

## 1. Prerequisites

Before starting, confirm you have:

- A GitHub repository with this project pushed.
- A Render account connected to GitHub.
- Node.js services enabled in your Render account.
- Optional: an OpenRouter API key if you want backend estimator calls. Users can also enter their own OpenRouter key directly in the frontend when running Quality Sweep.

You do not need an n8n Cloud instance for the main app.

## 2. Deploy The Backend As A Render Web Service

The backend must be a Render Web Service because it is an Express API.

1. Open the Render dashboard.
2. Click **New**.
3. Select **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:

```text
Name: token-optimizer-api
Root Directory: backend
Runtime: Node
Branch: main
Build Command: npm install
Start Command: npm run start
Instance Type: Free
```

Render provides `PORT` automatically. You can omit `PORT` unless you have a specific reason to set it.

Recommended backend environment variables:

```env
CLIENT_ORIGIN=https://your-frontend-service.onrender.com
OPENROUTER_API_KEY=
OPENROUTER_ESTIMATOR_MODEL=openrouter/free
OPENROUTER_TIMEOUT_MS=25000
OPENROUTER_BASELINE_MEASUREMENT_ENABLED=false
OPENROUTER_SWEEP_JUDGE_MODEL=openrouter/free
OPENROUTER_SWEEP_MAX_TOKENS=1200
```

Optional local-plus-production CORS configuration:

```env
CLIENT_ORIGIN=https://your-frontend-service.onrender.com,http://localhost:5173
```

Notes:

- `OPENROUTER_API_KEY` is optional for instant estimates. Leave it blank to use deterministic backend estimation only.
- If you set `OPENROUTER_API_KEY`, store it only in Render environment variables. Quality Sweep can also use a request-scoped key entered by the user in the browser.
- Keep `OPENROUTER_BASELINE_MEASUREMENT_ENABLED=false` unless you intentionally want the backend to run the selected model for measured baseline usage. Turning it on can consume OpenRouter credits.
- `OPENROUTER_SWEEP_JUDGE_MODEL` controls the judge used by **Run quality sweep**.
- `OPENROUTER_SWEEP_MAX_TOKENS` caps each sweep model run. Lower values reduce cost but can truncate long answers.
- Do not add secrets to GitHub source files.

## 3. Verify The Backend

After the backend deploy finishes, open:

```text
https://your-backend-service.onrender.com/api/health
```

Example:

```text
https://token-optimizer-api.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok"
}
```

Then check the model catalog:

```text
https://your-backend-service.onrender.com/api/models
```

Expected response shape:

```json
{
  "data": [
    {
      "id": "provider/model-id",
      "name": "Model Name",
      "input_price": 0.001,
      "output_price": 0.002
    }
  ]
}
```

If `/api/health` works but `/api/models` fails, the backend is running but cannot reach the OpenRouter model catalog.

## 4. Deploy The Frontend As A Render Static Site

The frontend must be a Render Static Site because it is a Vite React app.

1. Open the Render dashboard.
2. Click **New**.
3. Select **Static Site**.
4. Connect the same GitHub repository.
5. Configure the site:

```text
Name: token-optimizer
Root Directory: frontend
Branch: main
Build Command: npm install && npm run build
Publish Directory: dist
```

Add this frontend environment variable:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

Example:

```env
VITE_API_BASE_URL=https://token-optimizer-api.onrender.com
```

`VITE_API_BASE_URL` is not a secret. It is the public backend URL that the browser calls.

After adding or changing this variable, redeploy the frontend. Vite reads `VITE_*` variables at build time, so the value is baked into generated static assets.

## 5. Update Backend CORS After Frontend URL Exists

After the frontend deploy finishes, copy the frontend URL from Render.

Example:

```text
https://token-optimizer.onrender.com
```

Go back to the backend Web Service and set:

```env
CLIENT_ORIGIN=https://token-optimizer.onrender.com
```

No trailing slash.

If you also want local development to call the deployed backend:

```env
CLIENT_ORIGIN=https://token-optimizer.onrender.com,http://localhost:5173
```

Redeploy or restart the backend after changing `CLIENT_ORIGIN`.

## 6. End-To-End Verification

Open the deployed frontend:

```text
https://your-frontend-service.onrender.com
```

Use this smoke test:

1. Enter a prompt:

   ```text
   Create a concise app plan for a project management dashboard with tasks, sprint status, budget tracking, and team workload.
   ```

2. Select a text-capable model.
3. Optionally enter a reasoning mode such as `Fast` or `Pro`.
4. Click **Estimate cost**.
5. Confirm the dashboard shows:
   - input tokens
   - visible output estimate
   - reasoning token estimate
   - billable output estimate
   - estimated cost
   - context window used, total context window, and usage percentage
   - inferred output type
   - model and mode recommendations

Optional quality sweep verification:

1. Use a short, low-cost prompt first.
2. Enter an OpenRouter API key in the Quality Sweep key field.
3. Click **Run quality sweep**.
4. Confirm the Quality Sweep tab shows:
   - measured baseline usage
   - candidate quality retention
   - candidate savings
   - latency
   - judge rationale

This action runs real model calls and can consume OpenRouter credits.

## 7. Troubleshooting

### Frontend Shows `Failed to fetch` For Models

Check:

- `VITE_API_BASE_URL` is set to the backend URL, not the frontend URL.
- The frontend was redeployed after setting `VITE_API_BASE_URL`.
- The backend `/api/health` URL works.
- `CLIENT_ORIGIN` on the backend exactly matches the frontend origin.

### Browser Console Shows CORS Error

Set backend `CLIENT_ORIGIN` to the frontend URL with no trailing slash.

Correct:

```env
CLIENT_ORIGIN=https://token-optimizer.onrender.com
```

Incorrect:

```env
CLIENT_ORIGIN=https://token-optimizer.onrender.com/
```

For local and production:

```env
CLIENT_ORIGIN=https://token-optimizer.onrender.com,http://localhost:5173
```

Restart the backend after changing this value.

### Estimate Works But Mentions Deterministic Fallback

This is allowed. It means `OPENROUTER_API_KEY` is not configured, OpenRouter rejected the optional estimator request, or the estimator timed out. The backend still returns a usable local estimate.

To enable OpenRouter estimator calls:

```env
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_ESTIMATOR_MODEL=openrouter/free
OPENROUTER_TIMEOUT_MS=25000
OPENROUTER_BASELINE_MEASUREMENT_ENABLED=false
OPENROUTER_SWEEP_JUDGE_MODEL=openrouter/free
OPENROUTER_SWEEP_MAX_TOKENS=1200
```

If your OpenRouter account has no credits or the free route is rate-limited, the app falls back automatically.

### Quality Sweep Says API Key Is Required

`Run quality sweep` cannot use deterministic fallback because it must execute the selected baseline and candidate models. Enter an OpenRouter API key in the Quality Sweep field in the frontend. The key is used only for that request, is not stored by TokenOptimizer, and is cleared after the request finishes.

For admin/local testing, you may also add a backend fallback key:

```env
OPENROUTER_API_KEY=your-openrouter-key
```

Then redeploy or restart the backend. Keep backend fallback keys out of GitHub and out of frontend environment variables.

### Render Free Service Sleeps

Free Render Web Services can sleep after inactivity. The first request after sleep may be slow. Open `/api/health` once before testing the frontend if the app has been idle.

### Model Catalog Is Empty

Open:

```text
https://your-backend-service.onrender.com/api/models
```

If it returns an error, Render may be blocked from reaching OpenRouter or OpenRouter may be temporarily unavailable. Wait and retry; the frontend depends on this endpoint for the model dropdown.

## 8. Deployment Checklist

```text
[ ] Backend Web Service root directory is backend
[ ] Backend start command is npm run start
[ ] Frontend Static Site root directory is frontend
[ ] Frontend publish directory is dist
[ ] VITE_API_BASE_URL points to the backend service
[ ] CLIENT_ORIGIN points to the frontend service
[ ] Optional OPENROUTER_API_KEY is set only in Render for estimator/admin fallback
[ ] Users can enter an OpenRouter key in the Quality Sweep field for request-scoped sweeps
[ ] /api/health returns {"status":"ok"}
[ ] /api/models returns model data
[ ] Frontend estimate flow works
[ ] No .env, API keys, logs, node_modules, or dist files are committed
```
