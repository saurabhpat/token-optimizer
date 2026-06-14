import fetch from "node-fetch";
import { env } from "../config/env.js";
import { inferPromptProfile } from "./promptInferenceService.js";
import { parseReasoningMode } from "./reasoningModeService.js";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const MEDIA_FLAT_OUTPUT_COST = {
  Image: 0.01,
  Audio: 0.02,
  Video: 0.05
};

function toFiniteNumber(value, fallbackValue = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function roundCurrency(value) {
  return Number(toFiniteNumber(value).toFixed(6));
}

function getTextCost(payload, predictedOutput) {
  const inputCost =
    toFiniteNumber(payload.input_tokens) * (toFiniteNumber(payload.input_price) / 1000);
  const outputCost =
    toFiniteNumber(predictedOutput) * (toFiniteNumber(payload.output_price) / 1000);

  return roundCurrency(inputCost + outputCost);
}

function getMediaCost(payload, outputType) {
  const inputCost =
    toFiniteNumber(payload.input_tokens) * (toFiniteNumber(payload.input_price) / 1000);
  const flatOutputCost = MEDIA_FLAT_OUTPUT_COST[outputType] ?? 0.01;

  return roundCurrency(inputCost + flatOutputCost);
}

function stripJsonFence(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseEstimatorContent(content) {
  const cleanedContent = stripJsonFence(content);

  if (!cleanedContent) {
    return null;
  }

  try {
    return JSON.parse(cleanedContent);
  } catch {
    const firstBrace = cleanedContent.indexOf("{");
    const lastBrace = cleanedContent.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(cleanedContent.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

function clampEstimatorVisibleTokens(value, fallbackValue, outputType) {
  if (["Image", "Audio", "Video"].includes(outputType)) {
    return 0;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallbackValue;
  }

  const lowerBoundRatio = outputType === "File" ? 0.85 : 0.45;
  const upperBoundRatio = outputType === "File" ? 1.75 : 2.25;
  const lowerBound = Math.max(1, Math.floor(fallbackValue * lowerBoundRatio));
  const upperBound = Math.max(lowerBound, Math.ceil(fallbackValue * upperBoundRatio));

  return Math.min(Math.max(Math.round(numericValue), lowerBound), upperBound);
}

function normalizeConfidence(value, fallbackValue) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallbackValue;
  }

  if (numericValue > 1) {
    return Math.min(Math.max(numericValue / 100, 0.35), 0.92);
  }

  return Math.min(Math.max(numericValue, 0.35), 0.92);
}

const PREDICTION_CONFIDENCE_FORMULA = [
  "Use OpenRouter estimator confidence when it returns a valid value.",
  "Normalize percent values such as 84 into 0.84, and keep decimal values such as 0.84 as-is.",
  "Use 0.78 as the fallback when OpenRouter assisted the estimate, or 0.68 when the deterministic backend estimate was used.",
  "Clamp the final score between 0.35 and 0.92 because this is a directional estimate, not measured accuracy."
];

function getPredictionConfidenceBasis(estimatorData, predictionConfidence) {
  const usedOpenRouterEstimator = Boolean(estimatorData);

  return [
    usedOpenRouterEstimator
      ? "OpenRouter returned a structured estimator response; the backend normalized and clamped its confidence value."
      : "OpenRouter estimator confidence was unavailable; the backend used deterministic heuristic confidence.",
    usedOpenRouterEstimator
      ? "OpenRouter-assisted fallback baseline is 0.78 before clamping."
      : "Deterministic backend fallback baseline is 0.68 before clamping.",
    `Displayed estimate confidence is ${Math.round(predictionConfidence * 100)}%.`
  ];
}

function getReasoningRequestConfig(reasoningMode) {
  const modeText = `${reasoningMode?.reasoning_mode_label ?? ""} ${reasoningMode?.reasoning_mode_input ?? ""}`.toLowerCase();
  const explicitBudgetMatch = modeText.match(/(?:budget_tokens|thinking budget|reasoning budget)?\s*[=:]?\s*(\d{3,6})\s*(?:tokens?)?/);

  if (explicitBudgetMatch) {
    return {
      max_tokens: Number(explicitBudgetMatch[1])
    };
  }

  if (
    modeText.includes("pro") ||
    modeText.includes("deep") ||
    modeText.includes("high") ||
    modeText.includes("xhigh")
  ) {
    return {
      effort: "high"
    };
  }

  if (
    modeText.includes("thinking") ||
    modeText.includes("reason") ||
    modeText.includes("adaptive")
  ) {
    return {
      effort: "medium"
    };
  }

  if (
    modeText.includes("fast") ||
    modeText.includes("low") ||
    modeText.includes("minimal") ||
    modeText.includes("flash")
  ) {
    return {
      effort: "low"
    };
  }

  return null;
}

function buildBaselineMessages(payload) {
  return [
    {
      role: "system",
      content:
        "Answer the user's request directly. Keep the response useful, structured, and concise unless the user explicitly asks for a long-form artifact."
    },
    {
      role: "user",
      content: payload.prompt
    }
  ];
}

async function callOpenRouterBaseline(payload, promptProfile, reasoningMode) {
  if (!env.openRouterBaselineMeasurementEnabled) {
    return {
      data: null,
      note: "Selected-model baseline run is disabled; backend estimate used as baseline."
    };
  }

  if (!env.openRouterApiKey) {
    return {
      data: null,
      note: "OpenRouter key is not configured; backend estimate used as baseline."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.openRouterTimeoutMs);
  const reasoningConfig = getReasoningRequestConfig(reasoningMode);

  try {
    const requestBody = {
      model: payload.model,
      temperature: 0.2,
      max_tokens: Math.min(
        Math.max(Math.ceil(promptProfile.visible_output_tokens), 256),
        1600
      ),
      messages: buildBaselineMessages(payload)
    };

    if (reasoningConfig) {
      requestBody.reasoning = reasoningConfig;
    }

    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    let responseData = {};

    try {
      responseData = await response.json();
    } catch {
      return {
        data: null,
        note: "Selected-model baseline returned invalid JSON; backend estimate used as baseline."
      };
    }

    if (!response.ok) {
      const upstreamMessage =
        responseData?.error?.message ||
        responseData?.message ||
        "Selected-model baseline request failed.";

      return {
        data: null,
        note: `${upstreamMessage} Backend estimate used as baseline.`
      };
    }

    const usage = responseData?.usage ?? {};
    const completionTokens = toFiniteNumber(usage.completion_tokens);
    const reasoningTokens = toFiniteNumber(
      usage.reasoning_tokens ??
        usage.completion_tokens_details?.reasoning_tokens ??
        usage.output_tokens_details?.reasoning_tokens
    );
    const visibleTokens =
      reasoningTokens > 0 && completionTokens > reasoningTokens
        ? completionTokens - reasoningTokens
        : completionTokens;
    const totalOutputTokens =
      completionTokens > 0
        ? completionTokens
        : visibleTokens + reasoningTokens;
    const actualCost = toFiniteNumber(usage.cost, NaN);

    if (completionTokens <= 0 && !Number.isFinite(actualCost)) {
      return {
        data: null,
        note: "Selected-model baseline did not include usage metadata; backend estimate used as baseline."
      };
    }

    return {
      data: {
        baseline_model: payload.model,
        baseline_reasoning_mode: reasoningMode.reasoning_mode_label,
        output_type: promptProfile.output_type,
        artifact_type: promptProfile.artifact_type,
        input_tokens: toFiniteNumber(usage.prompt_tokens, toFiniteNumber(payload.input_tokens)),
        attachment_tokens: toFiniteNumber(payload.attachment_tokens),
        visible_output_tokens: visibleTokens,
        reasoning_tokens: reasoningTokens,
        total_output_tokens: totalOutputTokens || completionTokens,
        actual_or_estimated_cost: Number.isFinite(actualCost) ? roundCurrency(actualCost) : null,
        latency_ms: null,
        finish_reason: responseData?.choices?.[0]?.finish_reason ?? "",
        generation_id: responseData?.id ?? "",
        measurement_source: "openrouter_response"
      },
      note: "Selected-model baseline run used OpenRouter response usage metadata."
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        data: null,
        note: "Selected-model baseline timed out; backend estimate used as baseline."
      };
    }

    return {
      data: null,
      note: "Selected-model baseline was unavailable; backend estimate used as baseline."
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildEstimatorMessages(payload, promptProfile, reasoningMode) {
  const attachmentSummary = Array.isArray(payload.input_attachments)
    ? payload.input_attachments.map((attachment) => ({
        type: attachment.type,
        name: attachment.name,
        mime_type: attachment.mime_type,
        token_estimate: attachment.token_estimate,
        confidence: attachment.confidence,
        method: attachment.method
      }))
    : [];

  return [
    {
      role: "system",
      content:
        "You are TokenOptimizer's estimation engine. Return only minified JSON with keys visible_output_tokens, output_type, artifact_type, prediction_confidence, optimization_tip, prediction_notes. Estimate the likely visible model output size and artifact modality. Do not include markdown."
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt: payload.prompt,
        selected_model: payload.model,
        input_tokens: payload.input_tokens,
        prompt_tokens: payload.prompt_tokens,
        attachment_tokens: payload.attachment_tokens,
        input_attachments: attachmentSummary,
        local_inference: {
          output_type: promptProfile.output_type,
          artifact_type: promptProfile.artifact_type,
          complexity: promptProfile.complexity,
          visible_output_tokens: promptProfile.visible_output_tokens
        },
        reasoning_mode: {
          input: reasoningMode.reasoning_mode_input,
          interpreted_mode: reasoningMode.reasoning_mode_label,
          estimated_reasoning_tokens: reasoningMode.reasoning_token_estimate
        }
      })
    }
  ];
}

async function callOpenRouterEstimator(payload, promptProfile, reasoningMode) {
  if (!env.openRouterApiKey) {
    return {
      data: null,
      note: "OpenRouter estimator key is not configured; deterministic backend estimate used."
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.openRouterTimeoutMs);

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: env.openRouterEstimatorModel,
        temperature: 0.1,
        max_tokens: 450,
        messages: buildEstimatorMessages(payload, promptProfile, reasoningMode)
      }),
      signal: controller.signal
    });

    let responseData = {};

    try {
      responseData = await response.json();
    } catch {
      return {
        data: null,
        note: "OpenRouter estimator returned invalid JSON; deterministic backend estimate used."
      };
    }

    if (!response.ok) {
      const upstreamMessage =
        responseData?.error?.message ||
        responseData?.message ||
        "OpenRouter estimator request failed.";

      return {
        data: null,
        note: `${upstreamMessage} Deterministic backend estimate used.`
      };
    }

    const content = responseData?.choices?.[0]?.message?.content;
    const parsedContent = parseEstimatorContent(content);

    if (!parsedContent || typeof parsedContent !== "object") {
      return {
        data: null,
        note: "OpenRouter estimator response was malformed; deterministic backend estimate used."
      };
    }

    return {
      data: parsedContent,
      note: "OpenRouter estimator adjusted the backend heuristic."
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        data: null,
        note: "OpenRouter estimator timed out; deterministic backend estimate used."
      };
    }

    return {
      data: null,
      note: "OpenRouter estimator was unavailable; deterministic backend estimate used."
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOptimizationTip(promptProfile, reasoningMode, predictionNote) {
  const parts = [
    `${promptProfile.artifact_type} artifact inferred as ${promptProfile.output_type} output.`,
    `Reasoning mode interpreted as ${reasoningMode.reasoning_mode_label}.`
  ];

  if (
    reasoningMode.reasoning_mode_bucket ===
    reasoningMode.recommended_reasoning_mode_bucket
  ) {
    parts.push(
      `${reasoningMode.recommended_reasoning_mode} is the recommended default for this estimate.`
    );
  } else if (reasoningMode.mode_cost_delta_tokens > 0) {
    parts.push(
      `${reasoningMode.recommended_reasoning_mode} is the recommended cheaper mode for similar accuracy when the prompt does not require deeper reasoning.`
    );
  } else {
    parts.push(
      `${reasoningMode.recommended_reasoning_mode} is the recommended reliability baseline for this estimate.`
    );
  }

  if (reasoningMode.mode_cost_delta_tokens > 0) {
    parts.push(
      `The entered mode adds about ${reasoningMode.mode_cost_delta_tokens} more reasoning tokens than the recommended mode.`
    );
  }

  if (predictionNote) {
    parts.push(predictionNote);
  }

  return parts.join(" ");
}

export async function analyzeWithBackendEstimator(payload) {
  const promptProfile = inferPromptProfile(payload);
  const initialReasoningMode = parseReasoningMode(
    payload.reasoning_mode,
    promptProfile,
    promptProfile.visible_output_tokens
  );
  const estimatorResult = await callOpenRouterEstimator(
    payload,
    promptProfile,
    initialReasoningMode
  );
  const estimatorData = estimatorResult.data;
  let visibleOutputTokens = clampEstimatorVisibleTokens(
    estimatorData?.visible_output_tokens ?? estimatorData?.predicted_output,
    promptProfile.visible_output_tokens,
    promptProfile.output_type
  );
  let reasoningMode = parseReasoningMode(
    payload.reasoning_mode,
    promptProfile,
    visibleOutputTokens
  );
  let predictedOutput = visibleOutputTokens + reasoningMode.reasoning_token_estimate;
  let estimatedCost = ["Image", "Audio", "Video"].includes(promptProfile.output_type)
    ? getMediaCost(payload, promptProfile.output_type)
    : getTextCost(payload, predictedOutput);
  const baselineResult = await callOpenRouterBaseline(
    payload,
    {
      ...promptProfile,
      visible_output_tokens: visibleOutputTokens
    },
    reasoningMode
  );

  if (baselineResult.data && !["Image", "Audio", "Video"].includes(promptProfile.output_type)) {
    visibleOutputTokens =
      baselineResult.data.visible_output_tokens || visibleOutputTokens;
    reasoningMode = {
      ...reasoningMode,
      reasoning_token_estimate:
        baselineResult.data.reasoning_tokens ??
        reasoningMode.reasoning_token_estimate
    };
    predictedOutput =
      baselineResult.data.total_output_tokens ||
      visibleOutputTokens + reasoningMode.reasoning_token_estimate;
    estimatedCost = Number.isFinite(Number(baselineResult.data.actual_or_estimated_cost))
      ? roundCurrency(baselineResult.data.actual_or_estimated_cost)
      : getTextCost(payload, predictedOutput);
  }
  const predictionConfidence = normalizeConfidence(
    estimatorData?.prediction_confidence,
    estimatorData ? 0.78 : 0.68
  );
  const modeCostDelta = roundCurrency(
    reasoningMode.mode_cost_delta_tokens *
      (toFiniteNumber(payload.output_price) / 1000)
  );

  return {
    input_tokens: toFiniteNumber(payload.input_tokens),
    predicted_output: predictedOutput,
    estimated_cost: estimatedCost,
    optimization_tip:
      typeof estimatorData?.optimization_tip === "string" &&
      estimatorData.optimization_tip.trim()
        ? `${buildOptimizationTip(promptProfile, reasoningMode, estimatorResult.note)} ${estimatorData.optimization_tip.trim()}`
        : buildOptimizationTip(promptProfile, reasoningMode, estimatorResult.note),
    output_type: promptProfile.output_type,
    artifact_type: promptProfile.artifact_type,
    visible_output_tokens: visibleOutputTokens,
    reasoning_token_estimate: reasoningMode.reasoning_token_estimate,
    reasoning_mode_input: reasoningMode.reasoning_mode_input,
    reasoning_mode_bucket: reasoningMode.reasoning_mode_bucket,
    reasoning_mode_label: reasoningMode.reasoning_mode_label,
    recommended_reasoning_mode: reasoningMode.recommended_reasoning_mode,
    recommended_reasoning_mode_bucket:
      reasoningMode.recommended_reasoning_mode_bucket,
    reasoning_mode_rationale: reasoningMode.reasoning_mode_rationale,
    mode_selection_criteria: reasoningMode.mode_selection_criteria,
    mode_cost_delta: modeCostDelta,
    mode_cost_delta_tokens: reasoningMode.mode_cost_delta_tokens,
    prompt_tokens: toFiniteNumber(payload.prompt_tokens),
    attachment_tokens: toFiniteNumber(payload.attachment_tokens),
    input_attachments: Array.isArray(payload.input_attachments)
      ? payload.input_attachments
      : [],
    predicted_output_min:
      promptProfile.predicted_output_min + reasoningMode.reasoning_token_estimate,
    predicted_output_max:
      promptProfile.predicted_output_max + reasoningMode.reasoning_token_estimate,
    prediction_method: estimatorData
      ? "backend_openrouter_estimator"
      : "backend_deterministic_estimator",
    prediction_confidence: predictionConfidence,
    prediction_confidence_basis: getPredictionConfidenceBasis(
      estimatorData,
      predictionConfidence
    ),
    confidence_formula: PREDICTION_CONFIDENCE_FORMULA,
    prediction_notes: [
      ...promptProfile.inference_notes,
      reasoningMode.reasoning_mode_rationale,
      reasoningMode.mode_selection_criteria,
      estimatorResult.note,
      baselineResult.note,
      typeof estimatorData?.prediction_notes === "string"
        ? estimatorData.prediction_notes.trim()
        : ""
    ].filter(Boolean),
    baseline_usage: baselineResult.data ?? {
      baseline_model: payload.model,
      baseline_reasoning_mode: reasoningMode.reasoning_mode_label,
      output_type: promptProfile.output_type,
      artifact_type: promptProfile.artifact_type,
      input_tokens: toFiniteNumber(payload.input_tokens),
      prompt_tokens: toFiniteNumber(payload.prompt_tokens),
      attachment_tokens: toFiniteNumber(payload.attachment_tokens),
      visible_output_tokens: visibleOutputTokens,
      reasoning_tokens: reasoningMode.reasoning_token_estimate,
      total_output_tokens: predictedOutput,
      actual_or_estimated_cost: estimatedCost,
      measurement_source: estimatorData
        ? "backend_openrouter_estimator"
        : "backend_deterministic_estimator"
    }
  };
}
