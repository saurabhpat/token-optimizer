import fetch from "node-fetch";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

const OPENROUTER_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=all";
const REQUEST_TIMEOUT_MS = 5000;

function toNonNegativeNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function toPerThousandTokens(value) {
  const numericValue = toNonNegativeNumber(value);

  if (numericValue === null) {
    return null;
  }

  return Number((numericValue * 1000).toFixed(6));
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
    : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function normalizePricing(pricing) {
  return {
    prompt: toNonNegativeNumber(pricing?.prompt),
    completion: toNonNegativeNumber(pricing?.completion),
    request: toNonNegativeNumber(pricing?.request),
    image: toNonNegativeNumber(pricing?.image),
    internal_reasoning: toNonNegativeNumber(pricing?.internal_reasoning),
    input_cache_read: toNonNegativeNumber(pricing?.input_cache_read),
    input_cache_write: toNonNegativeNumber(pricing?.input_cache_write)
  };
}

function normalizeTopProvider(topProvider) {
  return {
    context_length: Number.isFinite(Number(topProvider?.context_length))
      ? Number(topProvider.context_length)
      : null,
    max_completion_tokens: Number.isFinite(Number(topProvider?.max_completion_tokens))
      ? Number(topProvider.max_completion_tokens)
      : null,
    is_moderated:
      typeof topProvider?.is_moderated === "boolean"
        ? topProvider.is_moderated
        : null
  };
}

function normalizeModel(model) {
  const promptPrice = toPerThousandTokens(model?.pricing?.prompt);
  const completionPrice = toPerThousandTokens(model?.pricing?.completion);
  const modelId = normalizeString(model?.id);
  const modelName = normalizeString(model?.name);
  const topProvider = normalizeTopProvider(model?.top_provider ?? {});

  if (!modelId) {
    return null;
  }

  return {
    id: modelId,
    name: modelName || modelId,
    canonical_slug: normalizeString(model?.canonical_slug),
    created: Number.isFinite(Number(model?.created)) ? Number(model.created) : null,
    description: normalizeString(model?.description),
    input_price: promptPrice ?? 0,
    output_price: completionPrice ?? 0,
    pricing: normalizePricing(model?.pricing ?? {}),
    input_modalities: normalizeStringArray(model?.architecture?.input_modalities),
    output_modalities: normalizeStringArray(model?.architecture?.output_modalities),
    context_length: Number.isFinite(Number(model?.context_length))
      ? Number(model.context_length)
      : topProvider.context_length,
    supported_parameters: normalizeStringArray(model?.supported_parameters),
    default_parameters: normalizeObject(model?.default_parameters),
    top_provider: topProvider,
    expiration_date:
      typeof model?.expiration_date === "string" && model.expiration_date.trim()
        ? model.expiration_date.trim()
        : null
  };
}

export async function fetchOpenRouterModels() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let upstreamResponse;
  const headers = {
    Accept: "application/json",
    "Cache-Control": "no-store"
  };

  if (env.openRouterApiKey) {
    headers.Authorization = `Bearer ${env.openRouterApiKey}`;
  }

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
