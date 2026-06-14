import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Layers,
  Loader2,
  Sparkles,
  WalletCards
} from "lucide-react";
import { formatNumber, formatPrice } from "../lib/formatters";
import CalculationExplainer from "./CalculationExplainer";
import StatCard from "./StatCard";

function EmptyState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white px-5 py-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-soft text-primary">
        <BarChart3 className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-semibold text-ink">Ready to compare</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Add a prompt, choose a model, and estimate cost before execution.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-border bg-white px-5 py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="mt-4 text-lg font-semibold text-ink">Estimating cost</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Running backend-native prompt inference and reasoning-mode estimation.
      </p>
    </div>
  );
}

function SweepLoadingState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-border bg-white px-5 py-8 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="mt-4 text-lg font-semibold">Running quality sweep</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Running the selected baseline and shortlisted alternatives through
        OpenRouter, then judging quality retention against the baseline.
      </p>
    </div>
  );
}

function ErrorState({ message, activeAction }) {
  const title =
    activeAction === "sweep" ? "Quality Sweep failed" : "Estimate failed";

  return (
    <div className="min-h-[220px] rounded-lg border border-rose-200 bg-rose-50 px-5 py-8">
      <div className="flex items-center gap-3 text-rose-700">
        <AlertCircle className="h-6 w-6" />
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-4 text-sm leading-6 text-rose-700">{message}</p>
    </div>
  );
}

function formatSignedNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  const sign = numericValue > 0 ? "+" : "";
  return `${sign}${formatNumber(numericValue)}`;
}

function formatNullableNumber(value) {
  return Number.isFinite(Number(value)) ? formatNumber(Number(value)) : "--";
}

function formatNullablePrice(value) {
  return Number.isFinite(Number(value)) ? formatPrice(Number(value)) : "--";
}

function formatPercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return `${Math.round(numericValue <= 1 ? numericValue * 100 : numericValue)}%`;
}

function formatWholePercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return `${Math.round(numericValue)}%`;
}

function AttachmentSummary({ inputBreakdown }) {
  const attachments = Array.isArray(inputBreakdown?.input_attachments)
    ? inputBreakdown.input_attachments
    : [];

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-sm font-semibold text-ink">Input token breakdown</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <div className="rounded-md bg-soft px-3 py-2">
          Prompt: {formatNullableNumber(inputBreakdown.prompt_tokens)} tokens
        </div>
        <div className="rounded-md bg-soft px-3 py-2">
          Attachments: {formatNullableNumber(inputBreakdown.attachment_tokens)}{" "}
          tokens
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id ?? attachment.name}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-soft px-3 py-2 text-xs text-slate-600"
          >
            <span className="font-medium text-ink">{attachment.name}</span>
            <span>
              {formatNullableNumber(attachment.token_estimate)} tokens,{" "}
              {attachment.confidence} confidence
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultsTabs({ tabs, activeTab, onChangeTab }) {
  return (
    <div className="flex rounded-lg border border-border bg-soft p-1">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChangeTab(tab)}
            className={[
              "flex-1 rounded-md px-3 py-2 text-sm font-semibold transition",
              isActive
                ? "bg-white text-primary shadow-soft"
                : "text-slate-600 hover:text-ink"
            ].join(" ")}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function EstimateTab({ result, selectedModel, inputBreakdown }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <h2 className="text-sm font-semibold text-ink">Estimate ready</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            This estimate combines your prompt size, selected model prices,
            likely answer length, and optional thinking-mode cost.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-white px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-500">Inferred output</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {result.output_type ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-500">Artifact</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {result.artifact_type ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-500">Reasoning mode</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {result.reasoning_mode_label ?? result.reasoning_mode_input ?? "Standard"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white px-3 py-2.5">
          <p className="text-xs font-semibold text-slate-500">Recommended</p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {result.recommended_reasoning_mode ?? "--"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          Optimization strategy
        </div>
        <p className="mt-2 max-h-28 overflow-y-auto whitespace-pre-line pr-1 text-sm leading-6 text-slate-700">
          {result.optimization_tip}
        </p>
      </div>

      <AttachmentSummary inputBreakdown={inputBreakdown} />
      <CalculationExplainer
        selectedModel={selectedModel}
        inputBreakdown={inputBreakdown}
        result={result}
      />
    </div>
  );
}

function pillColorClasses(color) {
  if (color === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (color === "yellow") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-rose-200 bg-rose-50 text-rose-800";
}

/**
 * A pill that leads with the score % (large + bold) and uses the label
 * as smaller supporting text below it. This makes the number scannable
 * at a glance without needing to parse word-labels first.
 */
function FactorPill({ label, score, color }) {
  const displayScore = Number.isFinite(Number(score)) ? Math.round(Number(score)) : null;

  return (
    <span
      className={[
        "inline-flex flex-col items-center rounded-xl border px-3 py-1.5 min-w-[72px]",
        pillColorClasses(color)
      ].join(" ")}
    >
      <span className="text-sm font-bold leading-tight">
        {displayScore !== null ? `${displayScore}%` : "—"}
      </span>
      <span className="mt-0.5 text-[10px] font-medium leading-none opacity-80">
        {label}
      </span>
    </span>
  );
}

function ConfidenceBar({ score, label }) {
  const width = Math.round(Math.min(Math.max(Number(score) || 0, 0), 100));
  const barColor =
    width >= 72
      ? "bg-emerald-500"
      : width >= 58
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{label ?? ""}</span>
        <span className="text-sm font-bold text-ink">{width}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={["h-full rounded-full transition-all duration-500", barColor].join(" ")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function RecommendationsTab({
  recommendations,
  selectedRecommendationId,
  onSelectRecommendation,
  onOpenPrompt,
  onOpenRankingGuide
}) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-sm text-slate-500">
        No model recommendations were returned for this estimate.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recommendations.map((recommendation, index) => {
        const isSelected = recommendation.model_id === selectedRecommendationId;

        // Prefer the new simplified fields, fall back to legacy.
        const blendedScore =
          Number.isFinite(Number(recommendation.simplified_confidence_score))
            ? Number(recommendation.simplified_confidence_score)
            : Number.isFinite(Number(recommendation.confidence_percent))
              ? Number(recommendation.confidence_percent)
              : 0;
        const blendedLabel =
          recommendation.simplified_confidence_label ??
          recommendation.confidence_label ??
          "";

        // Fallback calculations for the 3 factors in case they are missing from backend/cached response
        const breakdown = recommendation.confidence_breakdown || [];
        const capabilityFactor = breakdown.find((f) => f.key === "capability_match" || f.factor === "Capability Match");
        const taskFactor = breakdown.find((f) => f.key === "task_output_fit" || f.factor === "Task/Output Fit");
        const reasoningFactor = breakdown.find((f) => f.key === "reasoning_mode_equivalence" || f.factor === "Reasoning Mode Equivalence");
        const contextFactor = breakdown.find((f) => f.key === "context_attachment_safety" || f.factor === "Context Attachment Safety");
        const reliabilityFactor = breakdown.find((f) => f.key === "reliability_metadata" || f.factor === "Reliability/Metadata");

        const qualityRawEarned =
          (capabilityFactor?.earned ?? 0) +
          (taskFactor?.earned ?? 0) +
          (reasoningFactor?.earned ?? 0);
        const derivedQualityScore = Math.min(Math.max(Math.round((qualityRawEarned / 70) * 100), 0), 100);

        const contextRawEarned =
          (contextFactor?.earned ?? 0) +
          (reliabilityFactor?.earned ?? 0);
        const derivedContextScore = Math.min(Math.max(Math.round((contextRawEarned / 25) * 100), 0), 100);

        const derivedCostScore = Math.min(Math.max(Math.round(recommendation.savings_percent ?? 0), 0), 100);

        const getPillColor = (score) => {
          if (score >= 70) return "green";
          if (score >= 45) return "yellow";
          return "red";
        };

        const getPillLabel = (score, highLabel, midLabel, lowLabel) => {
          if (score >= 70) return highLabel;
          if (score >= 45) return midLabel;
          return lowLabel;
        };

        const qualityScore = recommendation.quality_match_score ?? derivedQualityScore;
        const qualityLabel = recommendation.quality_match_label ?? getPillLabel(qualityScore, "Strong", "Moderate", "Weak");
        const qualityColor = recommendation.quality_match_color ?? getPillColor(qualityScore);

        const costScore = recommendation.cost_efficiency_score ?? derivedCostScore;
        const costLabel = recommendation.cost_efficiency_label ?? getPillLabel(costScore, "High savings", "Moderate savings", "Low savings");
        const costColor = recommendation.cost_efficiency_color ?? getPillColor(costScore);

        const contextScore = recommendation.context_safety_score ?? derivedContextScore;
        const contextLabel = recommendation.context_safety_label ?? getPillLabel(contextScore, "Safe", "Marginal", "Risky");
        const contextColor = recommendation.context_safety_color ?? getPillColor(contextScore);

        const rankReasons = Array.isArray(recommendation.rank_reason_summary)
          ? recommendation.rank_reason_summary
          : [];

        return (
          <button
            key={recommendation.model_id}
            type="button"
            onClick={() => onSelectRecommendation(recommendation.model_id)}
            className={[
              "w-full rounded-lg border p-3 text-left transition",
              isSelected
                ? "border-primary bg-blue-50"
                : "border-border bg-white hover:border-blue-200 hover:bg-soft"
            ].join(" ")}
          >
            {/* Header row: rank + name + cost + savings badges */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <p className="truncate text-sm font-semibold text-ink">
                    {recommendation.model}
                  </p>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {recommendation.model_id}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-1 font-medium text-slate-600">
                  <WalletCards className="h-3.5 w-3.5 text-primary" />
                  {formatPrice(recommendation.estimated_cost)}
                </span>
                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                  Save {recommendation.savings_percent}%
                </span>
              </div>
            </div>

            {/* Blended confidence bar */}
            <div className="mt-3">
              <ConfidenceBar score={blendedScore} label={blendedLabel} />
            </div>

            {/* 3-factor pills — score is the primary visual, label is supporting */}
            <div className="mt-3 flex gap-3">
              <FactorPill
                label="Output Quality"
                score={qualityScore}
                color={qualityColor}
              />
              <FactorPill
                label="Cost Efficiency"
                score={costScore}
                color={costColor}
              />
              <FactorPill
                label="Context Safety"
                score={contextScore}
                color={contextColor}
              />
            </div>

            {/* Expandable reasoning */}
            {isSelected && rankReasons.length > 0 ? (
              <div className="mt-3 rounded-md border border-blue-100 bg-white p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-500">
                    Why this model?
                  </p>
                  <span
                    className="text-xs font-semibold text-primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenRankingGuide?.();
                    }}
                  >
                    How confidence works
                  </span>
                </div>
                <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600 sm:grid-cols-3">
                  {rankReasons.map((reason) => (
                    <li key={reason} className="rounded bg-soft px-2 py-1">
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-2 flex justify-end">
              <span
                className="text-xs font-semibold text-primary"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRecommendation(recommendation.model_id);
                  onOpenPrompt();
                }}
              >
                View optimized prompt
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}


function PromptTab({ recommendation, onUseRecommendation }) {
  const [copiedPromptId, setCopiedPromptId] = useState("");

  async function handleCopyPrompt() {
    if (!recommendation?.optimized_prompt) {
      return;
    }

    await navigator.clipboard.writeText(recommendation.optimized_prompt);
    setCopiedPromptId(recommendation.model_id);
    window.setTimeout(() => setCopiedPromptId(""), 1400);
  }

  if (!recommendation) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-sm text-slate-500">
        No optimized prompt is available for this estimate.
      </div>
    );
  }

  const optimizedPromptTokens = Number.isFinite(
    Number(recommendation.optimized_prompt_tokens)
  )
    ? Number(recommendation.optimized_prompt_tokens)
    : Number(recommendation.optimized_input_tokens);
  const optimizedAttachmentTokens = Number.isFinite(
    Number(recommendation.optimized_attachment_tokens)
  )
    ? Number(recommendation.optimized_attachment_tokens)
    : 0;
  const hasAttachmentTokens = optimizedAttachmentTokens > 0;

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {recommendation.model}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {recommendation.prompt_strategy ?? recommendation.prompt_change}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatNumber(optimizedPromptTokens)} prompt tokens
          </span>
          {hasAttachmentTokens ? (
            <span className="rounded-full border border-border bg-soft px-2 py-1">
              {formatNumber(optimizedAttachmentTokens)} file tokens preserved
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatNumber(recommendation.optimized_input_tokens)} total input
            tokens
          </span>
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatSignedNumber(recommendation.optimized_token_change)} total
            input delta
          </span>
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatPrice(recommendation.optimized_estimated_cost)}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-lg bg-soft p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Ready-to-use prompt
          </p>
          <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">
            {recommendation.optimized_prompt}
          </pre>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-500">Changes made</p>
          <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
            {(recommendation.changes_made ?? []).map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopyPrompt}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:border-blue-200 hover:bg-blue-50"
        >
          {copiedPromptId === recommendation.model_id ? (
            <Check className="h-4 w-4 text-success" />
          ) : (
            <Copy className="h-4 w-4 text-primary" />
          )}
          {copiedPromptId === recommendation.model_id ? "Copied" : "Copy prompt"}
        </button>
        <button
          type="button"
          onClick={() => onUseRecommendation?.(recommendation)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
        >
          <Sparkles className="h-4 w-4" />
          Use model + prompt
        </button>
      </div>
    </div>
  );
}

function SweepTab({ sweepResult }) {
  if (!sweepResult) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-sm text-slate-500">
        Run a quality sweep to measure baseline and candidate model outputs.
      </div>
    );
  }

  if (sweepResult.status === "unsupported") {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
        {sweepResult.message}
      </div>
    );
  }

  const baseline = sweepResult.baseline ?? {};
  const recommendation = sweepResult.recommendation ?? null;
  const candidates = Array.isArray(sweepResult.candidates)
    ? sweepResult.candidates
    : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-sm font-semibold text-ink">
          Measured baseline: {baseline.model_name ?? baseline.model ?? "--"}
        </p>
        <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <span className="rounded-md bg-white px-2 py-1">
            Cost {formatNullablePrice(baseline.actual_cost)}
          </span>
          <span className="rounded-md bg-white px-2 py-1">
            Output {formatNullableNumber(baseline.completion_tokens)} tokens
          </span>
          <span className="rounded-md bg-white px-2 py-1">
            Reasoning {formatNullableNumber(baseline.reasoning_tokens)} tokens
          </span>
          <span className="rounded-md bg-white px-2 py-1">
            Latency {formatNullableNumber(baseline.latency_ms)} ms
          </span>
        </div>
        {sweepResult.audit?.warnings?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600">
            {sweepResult.audit.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {recommendation ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-ink">
            Best measured substitute: {recommendation.model}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Preserved {formatWholePercent(recommendation.quality_retention_percent)}
            {" "}quality and saved {formatWholePercent(recommendation.savings_percent)}
            {" "}versus the selected baseline.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {candidates.map((candidate) => (
          <div
            key={candidate.model_id}
            className="rounded-lg border border-border bg-white p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  #{candidate.rank} {candidate.model}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Mode: {candidate.recommended_reasoning_mode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 font-semibold text-primary">
                  Quality retained {formatWholePercent(candidate.quality_retention_percent)}
                </span>
                <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                  Save {formatWholePercent(candidate.savings_percent)}
                </span>
                <span className="rounded-full border border-border bg-soft px-2 py-1 font-semibold text-slate-600">
                  {formatNullablePrice(candidate.actual_cost)}
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {candidate.judge?.rationale ??
                candidate.substitution_label ??
                "Candidate was compared against the selected baseline."}
            </p>
            {candidate.judge?.risk_flags?.length ? (
              <p className="mt-1 text-xs leading-5 text-amber-700">
                Risks: {candidate.judge.risk_flags.join(", ")}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessState({
  result,
  selectedModel,
  inputBreakdown,
  onUseRecommendation,
  onOpenRankingGuide
}) {
  const tabs = useMemo(
    () =>
      result?.sweep_result
        ? ["Estimate", "Quality Sweep", "Recommendations", "Prompt"]
        : ["Estimate", "Recommendations", "Prompt"],
    [result?.sweep_result]
  );
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const recommendations = Array.isArray(result.optimization_recommendations)
    ? result.optimization_recommendations
    : [];
  const [selectedRecommendationId, setSelectedRecommendationId] = useState(
    recommendations[0]?.model_id ?? ""
  );

  useEffect(() => {
    setActiveTab(result?.sweep_result ? "Quality Sweep" : tabs[0]);
    setSelectedRecommendationId(recommendations[0]?.model_id ?? "");
  }, [result, recommendations, tabs]);

  const selectedRecommendation = useMemo(
    () =>
      recommendations.find(
        (recommendation) =>
          recommendation.model_id === selectedRecommendationId
      ) ?? recommendations[0],
    [recommendations, selectedRecommendationId]
  );

  return (
    <div className="space-y-3">
      <ResultsTabs tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} />

      {activeTab === "Estimate" ? (
        <EstimateTab
          result={result}
          selectedModel={selectedModel}
          inputBreakdown={inputBreakdown}
        />
      ) : null}

      {activeTab === "Recommendations" ? (
        <RecommendationsTab
          recommendations={recommendations}
          selectedRecommendationId={selectedRecommendation?.model_id}
          onSelectRecommendation={setSelectedRecommendationId}
          onOpenPrompt={() => setActiveTab("Prompt")}
          onOpenRankingGuide={onOpenRankingGuide}
        />
      ) : null}

      {activeTab === "Quality Sweep" ? (
        <SweepTab sweepResult={result.sweep_result} />
      ) : null}

      {activeTab === "Prompt" ? (
        <PromptTab
          recommendation={selectedRecommendation}
          onUseRecommendation={onUseRecommendation}
        />
      ) : null}
    </div>
  );
}

export default function DashboardPanel({
  state,
  inputTokens,
  inputBreakdown,
  result,
  errorMessage,
  selectedModel,
  onUseRecommendation,
  onOpenRankingGuide,
  activeAction
}) {
  const hasEstimate = state === "success" && result;
  const isLoading = state === "loading";
  const hasError = state === "error";
  const visibleOutputValue = hasEstimate
    ? formatNullableNumber(result.visible_output_tokens)
    : "--";
  const reasoningOutputValue = hasEstimate
    ? formatNullableNumber(result.reasoning_token_estimate)
    : "--";
  const billableOutputValue = hasEstimate
    ? formatNullableNumber(result.predicted_output)
    : "--";
  const costValue = hasEstimate
    ? formatNullablePrice(result.estimated_cost)
    : "--";

  const contextTotal = Number.isFinite(Number(selectedModel?.context_length))
    ? Number(selectedModel.context_length)
    : 0;
  const estimatedOutput = hasEstimate && Number.isFinite(Number(result.predicted_output))
    ? Number(result.predicted_output)
    : 0;
  const contextUsed = inputTokens + estimatedOutput;
  const contextPercent = contextTotal > 0
    ? Math.min((contextUsed / contextTotal) * 100, 100)
    : 0;
  const contextPercentFormatted = contextTotal > 0
    ? `${contextPercent < 1 && contextPercent > 0 ? contextPercent.toFixed(2) : contextPercent.toFixed(1)}%`
    : "--";
  let contextPercentColor = "text-emerald-600";
  let contextPercentHint = "Comfortable usage";
  if (contextPercent >= 80) {
    contextPercentColor = "text-red-600";
    contextPercentHint = "Near context limit";
  } else if (contextPercent >= 50) {
    contextPercentColor = "text-amber-600";
    contextPercentHint = "Moderate usage";
  }

  return (
    <aside>
      <div className="rounded-lg border border-border bg-surface p-4 shadow-panel">
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
              Cost estimate
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Key cost numbers and recommendations.
            </p>
          </div>
          <div className="hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-soft text-primary sm:flex">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Prompt + file tokens"
            value={formatNumber(inputTokens)}
            hint={
              inputBreakdown?.attachment_tokens > 0
                ? "Prompt + attachments"
                : "Counted locally"
            }
          />
          <StatCard
            label="Estimated Output Tokens"
            value={visibleOutputValue}
            hint="What you will see"
          />
          <StatCard
            label="Thinking mode cost"
            value={reasoningOutputValue}
            hint="Extra thinking tokens"
          />
          <StatCard
            label="Total output tokens"
            value={billableOutputValue}
            hint="Answer + thinking"
          />
          <StatCard
            label="Estimated price"
            value={costValue}
            hint="Prompt + answer"
          />
        </div>

        {contextTotal > 0 ? (
          <>
            <div className="mb-3 mt-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                  Context estimate
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  How much of this model's context window your request uses.
                </p>
              </div>
              <div className="hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-soft text-primary sm:flex">
                <Layers className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <StatCard
                label="Context Window Used"
                value={formatNumber(contextUsed)}
                hint={hasEstimate ? "Input + estimated output" : "Input tokens only (pre-estimate)"}
              />
              <StatCard
                label="Total Context Window"
                value={formatNumber(contextTotal)}
                hint="Model's maximum capacity"
              />
              <StatCard
                label="Usage"
                value={contextPercentFormatted}
                hint={contextPercentHint}
                valueClassName={contextPercentColor}
              />
            </div>
          </>
        ) : null}

        <div className="mt-3">
          {isLoading && activeAction === "sweep" ? <SweepLoadingState /> : null}
          {isLoading && activeAction !== "sweep" ? <LoadingState /> : null}
          {!isLoading && hasError ? (
            <ErrorState message={errorMessage} activeAction={activeAction} />
          ) : null}
          {!isLoading && !hasError && hasEstimate ? (
            <SuccessState
              result={result}
              selectedModel={selectedModel}
              inputBreakdown={inputBreakdown}
              onUseRecommendation={onUseRecommendation}
              onOpenRankingGuide={onOpenRankingGuide}
            />
          ) : null}
          {!isLoading && !hasError && !hasEstimate ? <EmptyState /> : null}
        </div>
      </div>
    </aside>
  );
}
