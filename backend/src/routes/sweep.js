import { Router } from "express";
import { runQualitySweep } from "../services/sweepService.js";
import { validateAnalysisRequestBody } from "../utils/requestValidation.js";

const router = Router();

function normalizeSweepOptions(body) {
  const maxCandidates = Number(body?.max_candidates);
  const trials = Number(body?.trials);
  const openRouterApiKey =
    typeof body?.openrouter_api_key === "string"
      ? body.openrouter_api_key.trim()
      : "";

  return {
    max_candidates:
      Number.isFinite(maxCandidates) && maxCandidates > 0
        ? maxCandidates
        : 3,
    trials: Number.isFinite(trials) && trials > 0 ? trials : 1,
    openrouter_api_key: openRouterApiKey
  };
}

router.post("/", async (request, response, next) => {
  try {
    const { payload, candidateModels } = validateAnalysisRequestBody(
      request.body
    );
    const result = await runQualitySweep(
      payload,
      candidateModels,
      normalizeSweepOptions(request.body)
    );

    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
