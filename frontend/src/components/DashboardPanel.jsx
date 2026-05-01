import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  Gauge,
  Loader2,
  Sparkles,
  WalletCards
} from "lucide-react";
import { formatNumber, formatPrice } from "../lib/formatters";
import CalculationExplainer from "./CalculationExplainer";
import StatCard from "./StatCard";

function EmptyState() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-white px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-soft text-primary">
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
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-border bg-white px-6 py-10 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="mt-4 text-lg font-semibold text-ink">Estimating cost</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Waiting on the backend proxy and connected n8n workflow.
      </p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="min-h-[260px] rounded-lg border border-rose-200 bg-rose-50 px-6 py-10">
      <div className="flex items-center gap-3 text-rose-700">
        <AlertCircle className="h-6 w-6" />
        <h2 className="text-lg font-semibold">Estimate failed</h2>
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

function EstimateTab({ result, selectedModel, inputBreakdown, selectedOutputType }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div>
          <h2 className="text-sm font-semibold text-ink">Estimate ready</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This projection reflects the selected model pricing and the upstream
            n8n prediction.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          Optimization strategy
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
          {result.optimization_tip}
        </p>
      </div>

      <AttachmentSummary inputBreakdown={inputBreakdown} />
      <CalculationExplainer
        selectedModel={selectedModel}
        inputBreakdown={inputBreakdown}
        outputType={selectedOutputType}
      />
    </div>
  );
}

function RecommendationsTab({
  recommendations,
  selectedOutputType,
  selectedRecommendationId,
  onSelectRecommendation,
  onOpenPrompt
}) {
  if (recommendations.length === 0) {
    const modalityMessage =
      selectedOutputType === "Image" ||
      selectedOutputType === "Video" ||
      selectedOutputType === "Audiobook"
        ? `No compatible ${selectedOutputType.toLowerCase()} models found in the loaded OpenRouter catalog.`
        : "No model recommendations were returned for this estimate.";

    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-6 text-sm text-slate-500">
        {modalityMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((recommendation, index) => {
        const isSelected = recommendation.model_id === selectedRecommendationId;

        return (
          <button
            key={recommendation.model_id}
            type="button"
            onClick={() => onSelectRecommendation(recommendation.model_id)}
            className={[
              "w-full rounded-lg border p-4 text-left transition",
              isSelected
                ? "border-primary bg-blue-50"
                : "border-border bg-white hover:border-blue-200 hover:bg-soft"
            ].join(" ")}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
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

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-1 font-medium text-slate-600">
                  <WalletCards className="h-3.5 w-3.5 text-primary" />
                  {formatPrice(recommendation.estimated_cost)}
                </span>
                <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                  Save {recommendation.savings_percent}%
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-2 py-1 font-medium text-primary">
                  <Gauge className="h-3.5 w-3.5" />
                  {Math.round(recommendation.confidence_score * 100)}%
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
              <div>
                <p className="font-semibold text-slate-500">Mode</p>
                <p className="mt-1">{recommendation.mode}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-500">Accuracy</p>
                <p className="mt-1">{recommendation.accuracy}</p>
                {recommendation.confidence_basis ? (
                  <p className="mt-1 leading-5 text-slate-500">
                    {recommendation.confidence_basis}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="font-semibold text-slate-500">Prompt strategy</p>
                <p className="mt-1 leading-5">
                  {recommendation.prompt_strategy ??
                    recommendation.prompt_change}
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
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
            {formatNumber(recommendation.optimized_input_tokens)} tokens
          </span>
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatSignedNumber(recommendation.optimized_token_change)} token
            delta
          </span>
          <span className="rounded-full border border-border bg-soft px-2 py-1">
            {formatPrice(recommendation.optimized_estimated_cost)}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-lg bg-soft p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            Ready-to-use prompt
          </p>
          <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-ink">
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

function SuccessState({
  result,
  selectedModel,
  inputBreakdown,
  selectedOutputType,
  onUseRecommendation
}) {
  const tabs = useMemo(
    () => ["Estimate", "Recommendations", "Prompt"],
    []
  );
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const recommendations = Array.isArray(result.optimization_recommendations)
    ? result.optimization_recommendations
    : [];
  const [selectedRecommendationId, setSelectedRecommendationId] = useState(
    recommendations[0]?.model_id ?? ""
  );

  useEffect(() => {
    setActiveTab(tabs[0]);
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
    <div className="space-y-4">
      <ResultsTabs tabs={tabs} activeTab={activeTab} onChangeTab={setActiveTab} />

      {activeTab === "Estimate" ? (
        <EstimateTab
          result={result}
          selectedModel={selectedModel}
          inputBreakdown={inputBreakdown}
          selectedOutputType={selectedOutputType}
        />
      ) : null}

      {activeTab === "Recommendations" ? (
        <RecommendationsTab
          recommendations={recommendations}
          selectedOutputType={selectedOutputType}
          selectedRecommendationId={selectedRecommendation?.model_id}
          onSelectRecommendation={setSelectedRecommendationId}
          onOpenPrompt={() => setActiveTab("Prompt")}
        />
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
  selectedOutputType,
  onUseRecommendation
}) {
  const hasEstimate = state === "success" && result;
  const isLoading = state === "loading";
  const hasError = state === "error";
  const outputValue = hasEstimate
    ? formatNullableNumber(result.predicted_output)
    : "--";
  const costValue = hasEstimate
    ? formatNullablePrice(result.estimated_cost)
    : "--";

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="max-h-none rounded-lg border border-border bg-surface p-5 shadow-panel lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
              Decision panel
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">
              TokenOptimizer
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Estimate usage, compare model economics, and sanity-check prompt
              cost before you execute.
            </p>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-lg border border-border bg-soft text-primary sm:flex">
            <BarChart3 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="Input Tokens"
            value={formatNumber(inputTokens)}
            hint={
              inputBreakdown?.attachment_tokens > 0
                ? "Prompt + attachments"
                : "Counted locally"
            }
          />
          <StatCard
            label="Predicted Output"
            value={outputValue}
            hint="Returned by analysis"
          />
          <StatCard
            label="Estimated Cost"
            value={costValue}
            hint="Input + output"
          />
        </div>

        <div className="mt-5">
          {isLoading ? <LoadingState /> : null}
          {!isLoading && hasError ? (
            <ErrorState message={errorMessage} />
          ) : null}
          {!isLoading && !hasError && hasEstimate ? (
            <SuccessState
              result={result}
              selectedModel={selectedModel}
              inputBreakdown={inputBreakdown}
              selectedOutputType={selectedOutputType}
              onUseRecommendation={onUseRecommendation}
            />
          ) : null}
          {!isLoading && !hasError && !hasEstimate ? <EmptyState /> : null}
        </div>
      </div>
    </aside>
  );
}
