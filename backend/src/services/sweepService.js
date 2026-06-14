import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fetch from "node-fetch";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { analyzeWithBackendEstimator } from "./analysisEstimatorService.js";
import { enrichAnalysisWithOptimizations } from "./optimizationService.js";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_GENERATION_URL = "https://openrouter.ai/api/v1/generation";
const TEXT_OUTPUT_TYPES = new Set(["Text", "File"]);
const JUDGE_DIMENSIONS = [
  { key: "instruction_following", label: "Instruction following", weight: 25 },
  { key: "completeness", label: "Completeness", weight: 25 },
  { key: "task_specific_quality", label: "Task-specific quality", weight: 20 },
  { key: "structure_and_format", label: "Structure and format", weight: 15 },
  { key: "factual_grounding", label: "Factual grounding", weight: 10 },
  { key: "brevity", label: "Brevity", weight: 5 }
];

function toFiniteNumber(value, fallbackValue = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function roundCurrency(value) {
  return Number(toFiniteNumber(value).toFixed(6));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function redactSensitiveText(value) {
  return cleanText(value)
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gi, "[redacted_openrouter_key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/OPENROUTER_API_KEY\s*=\s*\S+/gi, "OPENROUTER_API_KEY=[redacted]");
}

function normalizeOpenRouterErrorMessage(value) {
  const message = redactSensitiveText(value);

  if (/insufficient credits|never purchased credits|purchase more|payment required/i.test(message)) {
    return "OpenRouter rejected the sweep because the provided key has insufficient credits or account access.";
  }

  if (/unauthorized|invalid api key|no auth credentials|forbidden|401|403/i.test(message)) {
    return "OpenRouter rejected the provided API key. Check that the key is valid, active, and has access to the selected model.";
  }

  return message || "OpenRouter model run failed.";
}

function hashPrompt(payload) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        prompt: payload.prompt,
        input_tokens: payload.input_tokens,
        attachment_tokens: payload.attachment_tokens,
        attachments: payload.input_attachments?.map((attachment) => ({
          type: attachment.type,
          size_bytes: attachment.size_bytes,
          token_estimate: attachment.token_estimate
        }))
      })
    )
    .digest("hex");
}

function getAttachmentSummary(payload) {
  const attachments = Array.isArray(payload.input_attachments)
    ? payload.input_attachments
    : [];

  if (attachments.length === 0) {
    return "No attachments.";
  }

  return attachments
    .map(
      (attachment) =>
        `${attachment.name} (${attachment.type || "file"}, ${attachment.token_estimate} estimated tokens, ${attachment.confidence || "unknown"} confidence, ${attachment.method || "metadata estimate"})`
    )
    .join("\n");
}

function truncateForJudge(value, limit = 12000) {
  const text = typeof value === "string" ? value : "";

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}\n\n[Truncated for judging]`;
}

function getOutputText(responseData) {
  const content = responseData?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part?.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

function getReasoningRequestConfig(reasoningMode) {
  const modeText = cleanText(reasoningMode).toLowerCase();
  const explicitBudgetMatch = modeText.match(
    /(?:budget_tokens|thinking budget|reasoning budget|budget)?\s*[=:]?\s*(\d{3,6})\s*(?:tokens?)?/
  );

  if (explicitBudgetMatch) {
    return {
      max_tokens: clamp(Number(explicitBudgetMatch[1]), 64, 128000),
      exclude: false
    };
  }

  if (/\b(xhigh|maximum|max)\b/.test(modeText)) {
    return { effort: "xhigh", exclude: false };
  }

  if (/\b(pro|deep|high|extended|expert|thorough)\b/.test(modeText)) {
    return { effort: "high", exclude: false };
  }

  if (/\b(thinking|reasoning|adaptive|deliberate|reflective)\b/.test(modeText)) {
    return { effort: "medium", exclude: false };
  }

  if (/\b(fast|flash|low|cheap|economy|lite|minimal)\b/.test(modeText)) {
    return { effort: "low", exclude: false };
  }

  return null;
}

function buildExecutionMessages(payload, analysis) {
  const attachmentSummary = getAttachmentSummary(payload);

  return [
    {
      role: "system",
      content:
        "You are participating in TokenOptimizer's quality sweep. Execute the user's request faithfully and return only the final user-facing answer. Do not mention the sweep, judging, model comparison, or token optimization. If the user references attachments, use only the attachment metadata shown here and do not invent file contents."
    },
    {
      role: "user",
      content: [
        payload.prompt,
        "",
        "Attachment metadata available to this sweep:",
        attachmentSummary,
        "",
        `Inferred output: ${analysis.output_type || "Text"} / ${analysis.artifact_type || "General"}`
      ].join("\n")
    }
  ];
}

function getMaxCompletionTokens(analysis) {
  const visibleOutputTokens = toFiniteNumber(analysis.visible_output_tokens, 600);
  const requested = Math.max(350, Math.ceil(visibleOutputTokens * 0.8));

  return clamp(requested, 250, env.openRouterSweepMaxTokens);
}

async function fetchGenerationMetadata(generationId, openRouterApiKey) {
  if (!generationId) {
    return null;
  }

  const url = new URL(OPENROUTER_GENERATION_URL);
  url.searchParams.set("id", generationId);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.data ?? null;
  } catch {
    return null;
  }
}

function normalizeUsage({
  responseData,
  generationMetadata,
  fallbackInputTokens,
  inputPrice,
  outputPrice
}) {
  const usage = responseData?.usage ?? {};
  const generation = generationMetadata ?? {};
  const promptTokens = toFiniteNumber(
    generation.tokens_prompt ?? generation.native_tokens_prompt ?? usage.prompt_tokens,
    fallbackInputTokens
  );
  const completionTokens = toFiniteNumber(
    generation.tokens_completion ??
      generation.native_tokens_completion ??
      usage.completion_tokens ??
      usage.output_tokens,
    0
  );
  const reasoningTokens = toFiniteNumber(
    generation.native_tokens_reasoning ??
      usage.reasoning_tokens ??
      usage.completion_tokens_details?.reasoning_tokens ??
      usage.output_tokens_details?.reasoning_tokens,
    0
  );
  const totalTokens = toFiniteNumber(
    usage.total_tokens,
    promptTokens + completionTokens
  );
  const costFromProvider = toFiniteNumber(
    generation.total_cost ?? generation.usage ?? usage.cost,
    NaN
  );
  const fallbackCost =
    promptTokens * (toFiniteNumber(inputPrice) / 1000) +
    completionTokens * (toFiniteNumber(outputPrice) / 1000);

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    reasoning_tokens: reasoningTokens,
    visible_output_tokens: Math.max(completionTokens - reasoningTokens, 0),
    total_tokens: totalTokens,
    cost: roundCurrency(Number.isFinite(costFromProvider) ? costFromProvider : fallbackCost),
    cost_source: Number.isFinite(costFromProvider)
      ? "openrouter_usage"
      : "local_price_math",
    latency_ms: toFiniteNumber(
      generation.latency ?? generation.generation_time,
      null
    )
  };
}

async function runOpenRouterModel({
  model,
  modelName,
  reasoningMode,
  payload,
  analysis,
  inputPrice,
  outputPrice,
  openRouterApiKey
}) {
  const startedAt = Date.now();
  const requestBody = {
    model,
    temperature: 0.2,
    max_tokens: getMaxCompletionTokens(analysis),
    messages: buildExecutionMessages(payload, analysis)
  };
  const reasoningConfig = getReasoningRequestConfig(reasoningMode);

  if (reasoningConfig) {
    requestBody.reasoning = reasoningConfig;
  }

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-OpenRouter-Title": "TokenOptimizer Quality Sweep"
      },
      body: JSON.stringify(requestBody)
    });
    let responseData = {};

    try {
      responseData = await response.json();
    } catch {
      responseData = {};
    }

    if (!response.ok) {
      const message =
        responseData?.error?.message ||
        responseData?.message ||
        "OpenRouter model run failed.";

      return {
        status: "failed",
        model,
        model_name: modelName || model,
        reasoning_mode: reasoningMode || "Standard",
        error: normalizeOpenRouterErrorMessage(message),
        latency_ms: Date.now() - startedAt
      };
    }

    const generationId = responseData?.id ?? "";
    const generationMetadata = await fetchGenerationMetadata(
      generationId,
      openRouterApiKey
    );
    const usage = normalizeUsage({
      responseData,
      generationMetadata,
      fallbackInputTokens: payload.input_tokens,
      inputPrice,
      outputPrice
    });
    const output = getOutputText(responseData);

    return {
      status: "completed",
      model,
      model_name: modelName || model,
      reasoning_mode: reasoningMode || "Standard",
      generation_id: generationId,
      finish_reason:
        generationMetadata?.finish_reason ??
        generationMetadata?.native_finish_reason ??
        responseData?.choices?.[0]?.finish_reason ??
        "",
      usage_source: generationMetadata
        ? "openrouter_generation_metadata"
        : "openrouter_response",
      latency_ms: usage.latency_ms ?? Date.now() - startedAt,
      output_preview: output.slice(0, 5000),
      output_characters: output.length,
      ...usage
    };
  } catch (error) {
    return {
      status: "failed",
      model,
      model_name: modelName || model,
      reasoning_mode: reasoningMode || "Standard",
      error:
        error instanceof Error
          ? normalizeOpenRouterErrorMessage(error.message)
          : "Unable to reach OpenRouter for this run.",
      latency_ms: Date.now() - startedAt
    };
  }
}

function buildAuditRubric(payload, analysis) {
  const attachmentCount = Array.isArray(payload.input_attachments)
    ? payload.input_attachments.length
    : 0;
  const warnings = [];

  if (cleanText(payload.prompt).split(/\s+/).length < 12) {
    warnings.push(
      "The prompt is short, so quality judging may be less reliable without clearer success criteria."
    );
  }

  if (attachmentCount > 0) {
    warnings.push(
      "File bytes stay local; the sweep can judge prompt-following with attachment metadata, but not hidden file content."
    );
  }

  return {
    task_type: analysis.artifact_type ?? "General",
    output_type: analysis.output_type ?? "Text",
    complexity: analysis.prediction_notes?.find((note) =>
      /complexity/i.test(note)
    ) ?? "Complexity inferred by backend estimator.",
    dimensions: JUDGE_DIMENSIONS.map((dimension) => ({
      key: dimension.key,
      label: dimension.label,
      weight: dimension.weight
    })),
    warnings
  };
}

function parseJudgeJson(value) {
  if (!value) {
    return null;
  }

  const rawText = typeof value === "string" ? value.trim() : "";
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1] : rawText;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);

    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      return null;
    }
  }
}

function normalizeJudgeScore(value, fallbackValue) {
  return clamp(Math.round(toFiniteNumber(value, fallbackValue)), 0, 100);
}

function fallbackJudgeScore(candidateRun, recommendation) {
  const heuristicConfidence = toFiniteNumber(
    recommendation?.confidence_percent,
    72
  );
  const hasOutput = candidateRun.status === "completed" && candidateRun.output_characters > 0;
  const finishPenalty = candidateRun.finish_reason === "length" ? 8 : 0;
  const score = clamp(heuristicConfidence - finishPenalty + (hasOutput ? 0 : -35), 0, 100);

  return {
    judge_source: "heuristic_fallback",
    baseline_quality_score: 100,
    candidate_quality_score: score,
    quality_retention_percent: score,
    accepted: score >= 80,
    rationale:
      "Judge model was unavailable or returned malformed JSON, so TokenOptimizer used the existing substitution-confidence heuristic plus run health.",
    risk_flags: hasOutput ? [] : ["Candidate did not return usable output."],
    dimension_scores: JUDGE_DIMENSIONS.map((dimension) => ({
      dimension: dimension.label,
      baseline_score: 5,
      candidate_score: Math.max(1, Math.round((score / 100) * 5)),
      reason: "Fallback score derived from heuristic model fit."
    }))
  };
}

async function judgeCandidate({
  payload,
  analysis,
  baselineRun,
  candidateRun,
  recommendation,
  openRouterApiKey
}) {
  if (candidateRun.status !== "completed") {
    return fallbackJudgeScore(candidateRun, recommendation);
  }

  const baselineFirst = Math.random() >= 0.5;
  const answerA = baselineFirst ? baselineRun.output_preview : candidateRun.output_preview;
  const answerB = baselineFirst ? candidateRun.output_preview : baselineRun.output_preview;
  const judgeMessages = [
    {
      role: "system",
      content:
        "You are a strict but fair LLM output evaluator. Compare two anonymized answers for the same user task. Do not reward verbosity alone. Penalize missing required format, skipped constraints, hallucinated facts or sources, and incomplete answers. Return only minified JSON."
    },
    {
      role: "user",
      content: JSON.stringify({
        user_prompt: payload.prompt,
        attachment_metadata: getAttachmentSummary(payload),
        inferred_output_type: analysis.output_type,
        inferred_artifact_type: analysis.artifact_type,
        rubric_dimensions: JUDGE_DIMENSIONS,
        answer_a: truncateForJudge(answerA),
        answer_b: truncateForJudge(answerB),
        required_json: {
          answer_a_score: "0-100",
          answer_b_score: "0-100",
          dimension_scores: [
            {
              dimension: "dimension name",
              answer_a_score: "1-5",
              answer_b_score: "1-5",
              reason: "short reason"
            }
          ],
          rationale: "short plain-language comparison",
          risk_flags: ["short risk labels"],
          accepted: "true if candidate preserves useful quality"
        }
      })
    }
  ];

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-OpenRouter-Title": "TokenOptimizer Quality Judge"
      },
      body: JSON.stringify({
        model: env.openRouterSweepJudgeModel,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: judgeMessages
      })
    });
    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      return fallbackJudgeScore(candidateRun, recommendation);
    }

    const parsed = parseJudgeJson(getOutputText(responseData));

    if (!parsed) {
      return fallbackJudgeScore(candidateRun, recommendation);
    }

    const answerAScore = normalizeJudgeScore(parsed.answer_a_score, 75);
    const answerBScore = normalizeJudgeScore(parsed.answer_b_score, 75);
    const baselineQualityScore = baselineFirst ? answerAScore : answerBScore;
    const candidateQualityScore = baselineFirst ? answerBScore : answerAScore;
    const qualityRetention = normalizeJudgeScore(
      baselineQualityScore > 0
        ? (candidateQualityScore / baselineQualityScore) * 100
        : candidateQualityScore,
      candidateQualityScore
    );

    return {
      judge_source: "openrouter_judge",
      judge_model: env.openRouterSweepJudgeModel,
      baseline_quality_score: baselineQualityScore,
      candidate_quality_score: candidateQualityScore,
      quality_retention_percent: clamp(qualityRetention, 0, 120),
      accepted:
        typeof parsed.accepted === "boolean"
          ? parsed.accepted
          : qualityRetention >= 80,
      rationale:
        typeof parsed.rationale === "string" && parsed.rationale.trim()
          ? parsed.rationale.trim()
          : "Candidate quality was judged against the selected baseline.",
      risk_flags: Array.isArray(parsed.risk_flags)
        ? parsed.risk_flags.filter((flag) => typeof flag === "string")
        : [],
      dimension_scores: Array.isArray(parsed.dimension_scores)
        ? parsed.dimension_scores.map((dimension) => ({
            dimension:
              typeof dimension.dimension === "string"
                ? dimension.dimension
                : "Dimension",
            baseline_score: baselineFirst
              ? toFiniteNumber(dimension.answer_a_score, null)
              : toFiniteNumber(dimension.answer_b_score, null),
            candidate_score: baselineFirst
              ? toFiniteNumber(dimension.answer_b_score, null)
              : toFiniteNumber(dimension.answer_a_score, null),
            reason:
              typeof dimension.reason === "string" ? dimension.reason : ""
          }))
        : []
    };
  } catch {
    return fallbackJudgeScore(candidateRun, recommendation);
  }
}

function getCostPerAcceptedAnswer(candidateCost, qualityRetention) {
  const cost = toFiniteNumber(candidateCost, 0);
  const retention = Math.max(toFiniteNumber(qualityRetention, 0) / 100, 0.1);

  return roundCurrency(cost / retention);
}

function getSavings(baselineCost, candidateCost) {
  const baseline = toFiniteNumber(baselineCost);
  const candidate = toFiniteNumber(candidateCost);
  const savings = Math.max(baseline - candidate, 0);

  return {
    money_saved: roundCurrency(savings),
    savings_percent: baseline > 0 ? Math.round((savings / baseline) * 100) : 0
  };
}

function getSweepLabel(score) {
  if (score >= 90) {
    return "Very likely to preserve quality";
  }

  if (score >= 80) {
    return "Strong quality-preserving alternative";
  }

  if (score >= 70) {
    return "Reasonable tradeoff";
  }

  return "Quality risk";
}

async function persistSweepResult(result) {
  try {
    const logDirectory = path.join(process.cwd(), ".runtime-logs");
    await fs.mkdir(logDirectory, { recursive: true });
    await fs.appendFile(
      path.join(logDirectory, "sweeps.jsonl"),
      `${JSON.stringify({
        prompt_hash: result.prompt_hash,
        measured_at: result.measured_at,
        baseline_model: result.baseline?.model,
        candidate_count: result.candidates?.length ?? 0,
        recommendation: result.recommendation
          ? {
              model: result.recommendation.model,
              quality_retention_percent:
                result.recommendation.quality_retention_percent,
              savings_percent: result.recommendation.savings_percent
            }
          : null
      })}\n`
    );
  } catch {
    // Local sweep history is useful but never required for the API response.
  }
}

function normalizeSweepOptions(options) {
  return {
    maxCandidates: clamp(Math.round(toFiniteNumber(options?.max_candidates, 3)), 1, 3),
    trials: clamp(Math.round(toFiniteNumber(options?.trials, 1)), 1, 3)
  };
}

export async function runQualitySweep(payload, candidateModels, options = {}) {
  const requestApiKey =
    typeof options?.openrouter_api_key === "string"
      ? options.openrouter_api_key.trim()
      : "";
  const openRouterApiKey = requestApiKey || env.openRouterApiKey;
  const credentialSource = requestApiKey ? "request_key" : "environment_key";

  if (!openRouterApiKey) {
    throw new AppError(
      "OpenRouter API key is required to run Quality Sweep.",
      400
    );
  }

  const sweepOptions = normalizeSweepOptions(options);
  const analysisResult = await analyzeWithBackendEstimator(payload);
  const enrichedPayload = {
    ...payload,
    intent: analysisResult.artifact_type,
    output_type: analysisResult.output_type
  };
  const enrichedAnalysis = enrichAnalysisWithOptimizations(
    analysisResult,
    enrichedPayload,
    candidateModels
  );

  if (!TEXT_OUTPUT_TYPES.has(enrichedAnalysis.output_type)) {
    return {
      ...enrichedAnalysis,
      sweep_result: {
        status: "unsupported",
        measured_at: new Date().toISOString(),
        credential_source: credentialSource,
        credit_required: true,
        measurement_source: "openrouter",
        message:
          "Quality sweep currently supports text and file/report style prompts. Media generation remains estimate-only in this version."
      }
    };
  }

  const shortlistedRecommendations = (
    enrichedAnalysis.optimization_recommendations ?? []
  ).slice(0, sweepOptions.maxCandidates);

  if (shortlistedRecommendations.length === 0) {
    throw new AppError(
      "No candidate recommendations are available to sweep.",
      400
    );
  }

  const baselineRun = await runOpenRouterModel({
    model: payload.model,
    modelName: payload.model,
    reasoningMode:
      payload.reasoning_mode ||
      enrichedAnalysis.reasoning_mode_label ||
      "Standard",
    payload,
    analysis: enrichedAnalysis,
    inputPrice: payload.input_price,
    outputPrice: payload.output_price,
    openRouterApiKey
  });

  if (baselineRun.status !== "completed") {
    throw new AppError(
      `Baseline model run failed: ${baselineRun.error || "OpenRouter did not return a usable baseline."}`,
      502
    );
  }

  const audit = buildAuditRubric(payload, enrichedAnalysis);
  const candidates = [];

  for (const recommendation of shortlistedRecommendations) {
    const sourceModel = candidateModels.find(
      (model) => model.id === recommendation.model_id
    );
    const candidateRun = await runOpenRouterModel({
      model: recommendation.model_id,
      modelName: recommendation.model,
      reasoningMode: recommendation.recommended_reasoning_mode || "Standard",
      payload,
      analysis: enrichedAnalysis,
      inputPrice: sourceModel?.input_price ?? recommendation.input_price ?? 0,
      outputPrice: sourceModel?.output_price ?? recommendation.output_price ?? 0,
      openRouterApiKey
    });
    const judge = await judgeCandidate({
      payload,
      analysis: enrichedAnalysis,
      baselineRun,
      candidateRun,
      recommendation,
      openRouterApiKey
    });
    const savings = getSavings(baselineRun.cost, candidateRun.cost);
    const costPerAcceptedAnswer = getCostPerAcceptedAnswer(
      candidateRun.cost,
      judge.quality_retention_percent
    );

    candidates.push({
      model_id: recommendation.model_id,
      model: recommendation.model,
      recommended_reasoning_mode:
        recommendation.recommended_reasoning_mode || "Standard",
      run_status: candidateRun.status,
      error: candidateRun.error,
      generation_id: candidateRun.generation_id,
      finish_reason: candidateRun.finish_reason,
      usage_source: candidateRun.usage_source,
      prompt_tokens: candidateRun.prompt_tokens,
      completion_tokens: candidateRun.completion_tokens,
      reasoning_tokens: candidateRun.reasoning_tokens,
      visible_output_tokens: candidateRun.visible_output_tokens,
      total_tokens: candidateRun.total_tokens,
      actual_cost: candidateRun.cost,
      cost_source: candidateRun.cost_source,
      latency_ms: candidateRun.latency_ms,
      output_preview: candidateRun.output_preview,
      quality_retention_percent: judge.quality_retention_percent,
      substitution_confidence: judge.quality_retention_percent,
      substitution_label: getSweepLabel(judge.quality_retention_percent),
      baseline_quality_score: judge.baseline_quality_score,
      candidate_quality_score: judge.candidate_quality_score,
      accepted: judge.accepted,
      money_saved: savings.money_saved,
      savings_percent: savings.savings_percent,
      cost_per_accepted_answer: costPerAcceptedAnswer,
      latency_delta_ms:
        Number.isFinite(Number(candidateRun.latency_ms)) &&
        Number.isFinite(Number(baselineRun.latency_ms))
          ? candidateRun.latency_ms - baselineRun.latency_ms
          : null,
      judge
    });
  }

  const rankedCandidates = candidates
    .sort((left, right) => {
      if (left.substitution_confidence !== right.substitution_confidence) {
        return right.substitution_confidence - left.substitution_confidence;
      }

      if (left.cost_per_accepted_answer !== right.cost_per_accepted_answer) {
        return left.cost_per_accepted_answer - right.cost_per_accepted_answer;
      }

      return toFiniteNumber(left.latency_ms, Infinity) - toFiniteNumber(right.latency_ms, Infinity);
    })
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
  const sweepResult = {
    status: "completed",
    measured_at: new Date().toISOString(),
    prompt_hash: hashPrompt(payload),
    sweep_mode: "quality_preserving_savings",
    credential_source: credentialSource,
    credit_required: true,
    measurement_source: "openrouter",
    max_candidates: sweepOptions.maxCandidates,
    trials: sweepOptions.trials,
    note:
      "This sweep runs the selected baseline and shortlisted candidate models through OpenRouter, then judges candidate output against a blinded baseline rubric.",
    audit,
    baseline: {
      model: baselineRun.model,
      model_name: baselineRun.model_name,
      reasoning_mode: baselineRun.reasoning_mode,
      generation_id: baselineRun.generation_id,
      finish_reason: baselineRun.finish_reason,
      usage_source: baselineRun.usage_source,
      prompt_tokens: baselineRun.prompt_tokens,
      completion_tokens: baselineRun.completion_tokens,
      reasoning_tokens: baselineRun.reasoning_tokens,
      visible_output_tokens: baselineRun.visible_output_tokens,
      total_tokens: baselineRun.total_tokens,
      actual_cost: baselineRun.cost,
      cost_source: baselineRun.cost_source,
      latency_ms: baselineRun.latency_ms,
      output_preview: baselineRun.output_preview
    },
    candidates: rankedCandidates,
    recommendation: rankedCandidates[0] ?? null
  };

  await persistSweepResult(sweepResult);

  return {
    ...enrichedAnalysis,
    sweep_result: sweepResult
  };
}
