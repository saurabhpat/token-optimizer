import fetch from "node-fetch";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { normalizeAnalysisResponse } from "../utils/normalizeAnalysisResponse.js";

function getUpstreamMessage(responseData, statusCode) {
  const primaryMessage =
    typeof responseData?.error === "string" && responseData.error.trim()
      ? responseData.error.trim()
      : typeof responseData?.message === "string" && responseData.message.trim()
        ? responseData.message.trim()
        : `The analysis service returned status ${statusCode}.`;

  const hint =
    typeof responseData?.hint === "string" && responseData.hint.trim()
      ? responseData.hint.trim()
      : "";

  if (!hint) {
    return primaryMessage;
  }

  return `${primaryMessage} ${hint}`;
}

function getFallbackOptimizationTip(payload) {
  const intent = typeof payload.intent === "string" ? payload.intent : "prompt";
  const promptLength =
    typeof payload.prompt === "string" ? payload.prompt.trim().length : 0;

  if (promptLength > 900) {
    return `For this ${intent} request, trim repeated context and move strict requirements into a short checklist to keep output cost predictable.`;
  }

  return `For this ${intent} request, keep the desired format explicit and remove any optional context that will not change the final answer.`;
}

function polishAnalysisResult(result, payload) {
  const genericFallbackPatterns = [
    "Fallback estimate used because the estimator returned malformed JSON.",
    "Fallback estimate used because the estimator response was incomplete."
  ];

  if (genericFallbackPatterns.includes(result.optimization_tip)) {
    return {
      ...result,
      optimization_tip: getFallbackOptimizationTip(payload)
    };
  }

  return result;
}

export async function analyzeWithN8n(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.n8nTimeoutMs);

  let upstreamResponse;

  try {
    upstreamResponse = await fetch(env.n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("The analysis service timed out.", 504);
    }

    throw new AppError("Unable to reach the analysis service.", 502);
  } finally {
    clearTimeout(timeoutId);
  }

  const responseText = await upstreamResponse.text();
  let responseData = {};

  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch {
      throw new AppError("The analysis service returned invalid JSON.", 502);
    }
  }

  if (!upstreamResponse.ok) {
    throw new AppError(
      getUpstreamMessage(responseData, upstreamResponse.status),
      502
    );
  }

  try {
    const normalizedResult = normalizeAnalysisResponse(responseData);
    return polishAnalysisResult(normalizedResult, payload);
  } catch (error) {
    throw new AppError(
      error instanceof Error
        ? error.message
        : "The analysis service returned an invalid payload.",
      502
    );
  }
}
