import { Router } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { analyzeWithBackendEstimator } from "../services/analysisEstimatorService.js";
import { enrichAnalysisWithOptimizations } from "../services/optimizationService.js";

const router = Router();

function normalizeAttachment(attachment) {
  const type = typeof attachment?.type === "string" ? attachment.type.trim() : "";
  const name = typeof attachment?.name === "string" ? attachment.name.trim() : "";
  const tokenEstimate = Number(attachment?.token_estimate);

  if (!type || !name || !Number.isFinite(tokenEstimate) || tokenEstimate < 0) {
    return null;
  }

  return {
    type,
    name,
    mime_type:
      typeof attachment?.mime_type === "string"
        ? attachment.mime_type.trim()
        : "",
    size_bytes: Number.isFinite(Number(attachment?.size_bytes))
      ? Number(attachment.size_bytes)
      : null,
    pages: Number.isFinite(Number(attachment?.pages))
      ? Number(attachment.pages)
      : null,
    width: Number.isFinite(Number(attachment?.width))
      ? Number(attachment.width)
      : null,
    height: Number.isFinite(Number(attachment?.height))
      ? Number(attachment.height)
      : null,
    token_estimate: tokenEstimate,
    confidence:
      typeof attachment?.confidence === "string"
        ? attachment.confidence.trim()
        : "",
    method:
      typeof attachment?.method === "string" ? attachment.method.trim() : ""
  };
}

function validateRequestBody(body) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  const inputTokens = Number(body?.input_tokens);
  const promptTokens = Number(body?.prompt_tokens);
  const attachmentTokens = Number(body?.attachment_tokens);
  const inputPrice = Number(body?.input_price);
  const outputPrice = Number(body?.output_price);
  const reasoningMode =
    typeof body?.reasoning_mode === "string" ? body.reasoning_mode.trim() : "";
  const inputAttachments = Array.isArray(body?.input_attachments)
    ? body.input_attachments.map(normalizeAttachment).filter(Boolean)
    : [];
  const candidateModels = Array.isArray(body?.candidate_models)
    ? body.candidate_models.slice(0, 500)
    : [];

  if (!prompt) {
    throw new AppError("Prompt is required.", 400);
  }

  if (!model) {
    throw new AppError("Model is required.", 400);
  }

  if (!Number.isFinite(inputTokens) || inputTokens < 0) {
    throw new AppError("input_tokens must be a valid non-negative number.", 400);
  }

  if (!Number.isFinite(inputPrice) || inputPrice < 0) {
    throw new AppError("input_price must be a valid non-negative number.", 400);
  }

  if (!Number.isFinite(outputPrice) || outputPrice < 0) {
    throw new AppError("output_price must be a valid non-negative number.", 400);
  }

  const payload = {
    prompt,
    model,
    reasoning_mode: reasoningMode,
    input_tokens: inputTokens,
    prompt_tokens: Number.isFinite(promptTokens) && promptTokens >= 0 ? promptTokens : inputTokens,
    attachment_tokens:
      Number.isFinite(attachmentTokens) && attachmentTokens >= 0
        ? attachmentTokens
        : 0,
    input_attachments: inputAttachments,
    input_price: inputPrice,
    output_price: outputPrice
  };

  return {
    payload,
    candidateModels
  };
}

router.post("/", async (request, response, next) => {
  try {
    const { payload, candidateModels } = validateRequestBody(request.body);
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
