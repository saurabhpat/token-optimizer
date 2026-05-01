import fetch from "node-fetch";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const REQUEST_TIMEOUT_MS = 5000;

function toPerThousandTokens(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Number((numericValue * 1000).toFixed(6));
}

function normalizeModel(model) {
  const promptPrice = toPerThousandTokens(model?.pricing?.prompt);
  const completionPrice = toPerThousandTokens(model?.pricing?.completion);
  const modelId = typeof model?.id === "string" ? model.id.trim() : "";
  const modelName = typeof model?.name === "string" ? model.name.trim() : "";

  if (!modelId || promptPrice === null || completionPrice === null) {
    return null;
  }

  return {
    id: modelId,
    name: modelName || modelId,
    input_price: promptPrice,
    output_price: completionPrice,
    input_modalities: Array.isArray(model?.architecture?.input_modalities)
      ? model.architecture.input_modalities.filter(
          (modality) => typeof modality === "string" && modality.trim()
        )
      : [],
    output_modalities: Array.isArray(model?.architecture?.output_modalities)
      ? model.architecture.output_modalities.filter(
          (modality) => typeof modality === "string" && modality.trim()
        )
      : [],
    context_length: Number.isFinite(Number(model?.context_length))
      ? Number(model.context_length)
      : null
  };
}

export async function fetchOpenRouterModels() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstreamResponse;
  const headers = {
    Accept: "application/json"
  };

  try {
    upstreamResponse = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("The model catalog request timed out.", 504);
    }

    throw new AppError("Unable to reach OpenRouter.", 502);
  } finally {
    clearTimeout(timeoutId);
  }

  let responseData = {};

  try {
    responseData = await upstreamResponse.json();
  } catch {
    throw new AppError("OpenRouter returned invalid JSON.", 502);
  }

  if (!upstreamResponse.ok) {
    const message =
      typeof responseData?.error?.message === "string" &&
      responseData.error.message.trim()
        ? responseData.error.message.trim()
        : typeof responseData?.message === "string" && responseData.message.trim()
          ? responseData.message.trim()
          : "OpenRouter model catalog request failed.";

    throw new AppError(message, 502);
  }

  if (!Array.isArray(responseData?.data)) {
    throw new AppError("OpenRouter model catalog response is invalid.", 502);
  }

  return responseData.data
    .map(normalizeModel)
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name));
}
