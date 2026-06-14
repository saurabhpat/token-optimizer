import { Router } from "express";
import { analyzeWithBackendEstimator } from "../services/analysisEstimatorService.js";
import { enrichAnalysisWithOptimizations } from "../services/optimizationService.js";
import { validateAnalysisRequestBody } from "../utils/requestValidation.js";

const router = Router();

router.post("/", async (request, response, next) => {
  try {
    const { payload, candidateModels } = validateAnalysisRequestBody(
      request.body
    );
    const result = await analyzeWithBackendEstimator(payload);
    const enrichedPayload = {
      ...payload,
      intent: result.artifact_type,
      output_type: result.output_type
    };

    response.json(
      enrichAnalysisWithOptimizations(result, enrichedPayload, candidateModels)
    );
  } catch (error) {
    next(error);
  }
});

export default router;
