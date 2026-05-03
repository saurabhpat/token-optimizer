# TokenOptimizer Render Deployment Guide

This guide explains how to deploy TokenOptimizer on Render with GitHub as the source repository, Render hosting both app services, and n8n handling the analysis workflow.

Production architecture:

```text
Browser
  -> Render Static Site: React frontend
  -> Render Web Service: Express backend
  -> n8n production webhook
  -> OpenRouter credential inside n8n
```

Keep this separation:

- The frontend is public and must not contain private webhook URLs or API keys.
- The backend stores the private n8n webhook URL in Render environment variables.
- n8n stores the OpenRouter credential.
- GitHub stores source code only.

## 1. Prerequisites

Before starting, confirm you have:

- A GitHub repository with this project pushed.
- A Render account connected to GitHub.
- An active n8n workflow imported from `n8n/TokenOptimizer Workflow.json`.
- An OpenRouter credential rebound inside the n8n `Call OpenRouter` node.
- Your production n8n webhook URL.

Use the production n8n webhook:

```text
https://your-n8n-domain/webhook/token-optimizer
```

Do not use the test webhook for deployment:

```text
https://your-n8n-domain/webhook-test/token-optimizer
```

## 2. Confirm n8n Is Ready

In n8n:

1. Import `n8n/TokenOptimizer Workflow.json`.
2. Open the `Call OpenRouter` node.
3. Select your own OpenRouter credential.
4. Confirm the webhook path is:

   ```text
   token-optimizer
   ```

5. Activate the workflow.
6. Copy the production webhook URL.

The committed workflow is intentionally safe for GitHub:

- It is inactive by default.
- It does not contain your private webhook URL.
- It does not contain OpenRouter API keys.
- It does not contain bound credential IDs.

## 3. Deploy The Backend As A Render Web Service

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

Render can provide the runtime `PORT` automatically. The backend also supports an explicit `PORT` variable if you choose to set one.

Recommended backend environment variables:

```env
N8N_WEBHOOK_URL=https://your-n8n-domain/webhook/token-optimizer
N8N_TIMEOUT_MS=30000
CLIENT_ORIGIN=https://your-frontend-service.onrender.com
```

Optional local-plus-production CORS configuration:

```env
CLIENT_ORIGIN=https://your-frontend-service.onrender.com,http://localhost:5173
```

If you set `PORT` manually, keep it consistent with your Render service configuration:

```env
PORT=3000
```

Do not add these values to GitHub source files.

## 4. Verify The Backend

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

## 5. Deploy The Frontend As A Render Static Site

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

After adding or changing this variable, redeploy the frontend. Vite reads `VITE_*` variables at build time, so the value is baked into the generated static assets.

## 6. Update Backend CORS After Frontend URL Exists

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

## 7. End-To-End Verification

Open the deployed frontend:

```text
https://your-frontend-service.onrender.com
```

Test the flow:

1. Confirm the model dropdown loads models.
2. Enter a prompt.
3. Select an output goal.
4. Select a model.
5. Click **Estimate cost**.
6. Confirm the dashboard shows:
   - Input tokens
   - Predicted output
   - Estimated cost
   - Optimization guidance
   - Recommendations

The expected runtime path is:

```text
Frontend /api/models request
  -> Render backend
  -> OpenRouter public model catalog

Frontend /api/analyze request
  -> Render backend
  -> n8n production webhook
  -> OpenRouter credential inside n8n
```

## 8. Troubleshooting

### Frontend Shows "No Models Available" Or "Failed To Fetch"

Open browser DevTools and check the failed request.

If it points to localhost:

```text
http://localhost:3000/api/models
```

then the frontend Render environment variable is missing or stale.

Fix:

```env
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

Redeploy the frontend after setting it.

### Browser Console Shows A CORS Error

Example:

```text
Access to fetch at 'https://your-backend-service.onrender.com/api/models'
from origin 'https://your-frontend-service.onrender.com'
has been blocked by CORS policy.
```

Fix the backend environment variable:

```env
CLIENT_ORIGIN=https://your-frontend-service.onrender.com
```

No trailing slash. Redeploy the backend.

### `/api/health` Returns Not Found

Make sure you are using the full HTTPS URL:

```text
https://your-backend-service.onrender.com/api/health
```

If it still returns `Not Found`, verify the backend service settings:

```text
Service Type: Web Service
Root Directory: backend
Build Command: npm install
Start Command: npm run start
```

### `/api/health` Works But `/api/models` Fails

The backend is alive, but it cannot fetch the OpenRouter model catalog.

Check Render logs for errors such as:

```text
Unable to reach OpenRouter.
The model catalog request timed out.
OpenRouter returned invalid JSON.
```

Wait and retry if OpenRouter is temporarily unavailable.

### Estimate Fails But Model Catalog Works

This usually means the backend can run but n8n is not returning the expected response.

Check:

- `N8N_WEBHOOK_URL` uses `/webhook/token-optimizer`, not `/webhook-test/token-optimizer`.
- The n8n workflow is active.
- The n8n `Call OpenRouter` node has your OpenRouter credential selected.
- The n8n workflow returns valid JSON with:

```json
{
  "input_tokens": 100,
  "predicted_output": 300,
  "estimated_cost": 0.0012,
  "optimization_tip": "Tip text"
}
```

### OpenRouter Says Too Many Requests

The workflow uses OpenRouter's free router for low-cost estimates. Free models can be rate-limited.

Expected behavior:

- n8n retries the OpenRouter call.
- If OpenRouter still fails, the workflow falls back to a heuristic estimate.

If this happens often, wait and retry later or use a paid OpenRouter model/route inside n8n.

### Render Free Service Feels Slow

Render free web services can spin down after inactivity. The next request wakes the service and can take about a minute.

This is normal on the free tier. Refresh once the backend has woken up.

## 9. Safe Configuration Checklist

Before sharing the deployed app:

```text
[ ] Backend /api/health returns {"status":"ok"}
[ ] Backend /api/models returns model data
[ ] Frontend has VITE_API_BASE_URL set to backend URL
[ ] Backend has CLIENT_ORIGIN set to frontend URL
[ ] Backend has N8N_WEBHOOK_URL set to production n8n webhook
[ ] n8n workflow is active
[ ] n8n OpenRouter credential is rebound
[ ] No .env files are committed
[ ] No OpenRouter keys are committed
[ ] No private webhook URLs are committed
```

## 10. Useful Render References

- Render Web Services: https://render.com/docs/web-services
- Render Static Sites: https://render.com/docs/static-sites
- Deploy Node Express on Render: https://render.com/docs/deploy-node-express-app
- Render Free Plan behavior: https://render.com/docs/free
