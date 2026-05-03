import { Router } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { analyzeWithN8n } from "../services/n8nService.js";
import { enrichAnalysisWithOptimizations } from "../services/optimizationService.js";

const router = Router();
const OUTPUT_TYPES = new Set(["Text", "File", "Image", "Audio", "Video"]);
const OUTPUT_TYPE_ALIASES = {
  Chat: "Text",
  Agent: "Text",
  App: "Text",
  Website: "Text",
  MCP: "Text",
  "Report/Document": "File",
  Audiobook: "Audio"
};
const NON_TEXT_OUTPUT_TYPES = new Set(["File", "Image", "Audio", "Video"]);

function normalizeOutputType(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();

  if (OUTPUT_TYPES.has(trimmedValue)) {
    return trimmedValue;
  }

  return OUTPUT_TYPE_ALIASES[trimmedValue] ?? "";
}

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
  const outputType =
    normalizeOutputType(body?.output_type) ||
    normalizeOutputType(body?.intent) ||
    "Text";
  const inputTokens = Number(body?.input_tokens);
  const promptTokens = Number(body?.prompt_tokens);
  const attachmentTokens = Number(body?.attachment_tokens);
  const inputPrice = Number(body?.input_price);
  const outputPrice = Number(body?.output_price);
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
    intent: outputType,
    output_type: outputType,
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

function applyOutputTypePolicy(result, payload) {
  const baseResult = {
    ...result,
    output_type: payload.output_type,
    prompt_tokens: payload.prompt_tokens,
    attachment_tokens: payload.attachment_tokens,
    input_attachments: payload.input_attachments
  };

  if (!NON_TEXT_OUTPUT_TYPES.has(payload.output_type)) {
    return baseResult;
  }

  return {
    ...baseResult,
    predicted_output: 0,
    predicted_output_min: 0,
    predicted_output_max: 0,
    estimated_cost: 0.01,
    optimization_tip:
      `Flat unit pricing applied for ${payload.output_type} output. ` +
      "Recommendations are restricted to models that advertise this output modality.",
    prediction_method: "backend_flat_unit_multimodal",
    prediction_confidence: 0.74
  };
}

router.post("/", async (request, response, next) => {
  try {
    const { payload, candidateModels } = validateRequestBody(request.body);
    const upstreamResult = NON_TEXT_OUTPUT_TYPES.has(payload.output_type)
      ? {
          input_tokens: payload.input_tokens,
          predicted_output: 0,
          estimated_cost: 0.01,
          optimization_tip: ""
        }
      : await analyzeWithN8n(payload);
    const result = applyOutputTypePolicy(upstreamResult, payload);
    response.json(enrichAnalysisWithOptimizations(result, payload, candidateModels));
  } catch (error) {
    next(error);
  }
});

export default router;
