import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Key,
  Loader2
} from "lucide-react";
import { runQualitySweep } from "../lib/api";
import { formatNumber, formatPrice } from "../lib/formatters";

const SWEEP_STORAGE_KEY = "tokenoptimizer-sweep-payload";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatNullablePrice(value) {
  return Number.isFinite(Number(value)) ? formatPrice(Number(value)) : "--";
}

function formatNullableNumber(value) {
  return Number.isFinite(Number(value)) ? formatNumber(Number(value)) : "--";
}

function formatWholePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return `${Math.round(n)}%`;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-shell-glow px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-white shadow-soft">
        <FlaskConical className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-xl font-semibold text-ink">No sweep context found</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Open this page from the Optimizer by clicking{" "}
        <strong>Run Quality Sweep</strong> after selecting a prompt and model.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Optimizer
      </a>
    </div>
  );
}

function ContextSummary({ sweepPayload }) {
  const { model, prompt, input_tokens, reasoning_mode } = sweepPayload;
  const promptPreview =
    typeof prompt === "string" && prompt.trim().length > 0
      ? prompt.trim().slice(0, 220) + (prompt.trim().length > 220 ? "…" : "")
      : "—";

  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-panel">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
        Sweep context
      </p>
      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-soft px-3 py-2">
          <p className="text-xs font-semibold text-slate-500">Baseline model</p>
          <p className="mt-1 font-semibold text-ink">{model ?? "—"}</p>
        </div>
        <div className="rounded-md bg-soft px-3 py-2">
          <p className="text-xs font-semibold text-slate-500">Input tokens</p>
          <p className="mt-1 font-semibold text-ink">
            {formatNullableNumber(input_tokens)}
          </p>
        </div>
        <div className="rounded-md bg-soft px-3 py-2">
          <p className="text-xs font-semibold text-slate-500">Reasoning mode</p>
          <p className="mt-1 font-semibold text-ink">
            {reasoning_mode?.trim() || "Standard"}
          </p>
        </div>
      </div>
      <div className="mt-3 rounded-md bg-soft px-3 py-2">
        <p className="text-xs font-semibold text-slate-500">Prompt preview</p>
        <p className="mt-1 text-xs leading-5 text-slate-700">{promptPreview}</p>
      </div>
    </div>
  );
}

function ApiKeySection({ apiKey, onChange, isBusy }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-panel">
      <div className="flex items-center gap-2">
        <Key className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-ink">
          OpenRouter API Key
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Used only for this sweep. TokenOptimizer does not store your key.
      </p>
      <input
        id="sweep-api-key"
        type="password"
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your OpenRouter key here"
        autoComplete="off"
        spellCheck="false"
        disabled={isBusy}
        className="mt-3 w-full rounded-lg border border-border bg-soft px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Your key is sent only with the sweep request and cleared from memory
        after it finishes.{" "}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Get a key
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}

function PreflightBox({ sweepPayload }) {
  const selectedModelName =
    sweepPayload?.candidate_models?.find(
      (m) => m.id === sweepPayload?.model
    )?.name ?? sweepPayload?.model ?? "Selected model";

  return (
    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-slate-600">
      <p className="font-semibold text-ink">Sweep preflight</p>
      <p className="mt-1">Baseline: {selectedModelName}</p>
      <p>Candidate runs: up to 3</p>
      <p>Judge calls: up to 3</p>
      <p className="mt-2 text-slate-500">
        Quality Sweep runs real models through OpenRouter and may consume credits.
      </p>
    </div>
  );
}

function SweepLoadingState() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-border bg-white px-5 py-8 text-center shadow-panel">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h2 className="mt-4 text-lg font-semibold text-ink">Running quality sweep</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
        Running the selected baseline and shortlisted alternatives through
        OpenRouter, then judging quality retention against the baseline.
      </p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-5 py-6 shadow-panel">
      <div className="flex items-center gap-3 text-rose-700">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-base font-semibold">Quality Sweep failed</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-rose-700">{message}</p>
    </div>
  );
}

function SweepResults({ sweepResult }) {
  if (!sweepResult) return null;

  if (sweepResult.status === "unsupported") {
    return (
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800 shadow-panel">
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
    <div className="space-y-4">
      {/* Success banner */}
      <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 shadow-soft">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-ink">Sweep complete</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Baseline and candidates were run through OpenRouter and judged for
            quality retention.
          </p>
        </div>
      </div>

      {/* Baseline */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 shadow-soft">
        <p className="text-sm font-semibold text-ink">
          Measured baseline: {baseline.model_name ?? baseline.model ?? "—"}
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
            {sweepResult.audit.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Best substitute */}
      {recommendation ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 shadow-soft">
          <p className="text-sm font-semibold text-ink">
            Best measured substitute: {recommendation.model}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Preserved{" "}
            {formatWholePercent(recommendation.quality_retention_percent)} quality
            and saved {formatWholePercent(recommendation.savings_percent)} versus
            the selected baseline.
          </p>
        </div>
      ) : null}

      {/* Candidates */}
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.model_id}
            className="rounded-lg border border-border bg-white p-4 shadow-soft"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  #{candidate.rank} {candidate.model}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Mode: {candidate.recommended_reasoning_mode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 font-semibold text-primary">
                  Quality retained{" "}
                  {formatWholePercent(candidate.quality_retention_percent)}
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

// ─── Main SweepView ─────────────────────────────────────────────────────────

export default function SweepView() {
  const [sweepPayload, setSweepPayload] = useState(null);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [sweepState, setSweepState] = useState("idle"); // idle | loading | success | error
  const [sweepResult, setSweepResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const apiKeyRef = useRef("");

  // Read and immediately clear the sweep payload from localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SWEEP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSweepPayload(parsed);
      }
    } catch {
      // Malformed storage — treat as missing.
    } finally {
      localStorage.removeItem(SWEEP_STORAGE_KEY);
      setHasCheckedStorage(true);
    }
  }, []);

  // Keep a ref in sync so the sweep handler always reads the latest key.
  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  const trimmedKey = apiKey.trim();
  const isBusy = sweepState === "loading";
  const canRun = Boolean(sweepPayload && trimmedKey && !isBusy);

  async function handleRunSweep() {
    if (!canRun) return;

    const key = apiKeyRef.current.trim();
    setSweepState("loading");
    setErrorMessage("");
    setSweepResult(null);

    try {
      const data = await runQualitySweep(sweepPayload, key);
      setSweepResult(data.sweep_result ?? null);
      setSweepState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to run the quality sweep right now."
      );
      setSweepState("error");
    } finally {
      // Clear key from memory immediately after use.
      setApiKey("");
      apiKeyRef.current = "";
    }
  }

  if (!hasCheckedStorage) {
    return null;
  }

  if (!sweepPayload) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-shell-glow">
      {/* Minimal header */}
      <header className="border-b border-border bg-white px-4 py-3 shadow-soft">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FlaskConical className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                TokenOptimizer — Quality Sweep
              </p>
              <p className="text-xs text-slate-500">
                Measure output quality against your baseline
              </p>
            </div>
          </div>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Optimizer
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
        <ContextSummary sweepPayload={sweepPayload} />

        {/* Controls — hidden once sweep succeeds */}
        {sweepState !== "success" ? (
          <div className="rounded-lg border border-border bg-white p-4 shadow-panel">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex-1">
                <ApiKeySection
                  apiKey={apiKey}
                  onChange={setApiKey}
                  isBusy={isBusy}
                />
              </div>
              <div className="lg:w-64">
                <PreflightBox sweepPayload={sweepPayload} />
              </div>
            </div>

            <div className="mt-4">
              <button
                id="run-sweep-btn"
                type="button"
                onClick={handleRunSweep}
                disabled={!canRun}
                className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? "Running sweep…" : "→ Run quality sweep"}
              </button>
            </div>
          </div>
        ) : null}

        {/* States */}
        {isBusy ? <SweepLoadingState /> : null}
        {sweepState === "error" ? <ErrorState message={errorMessage} /> : null}
        {sweepState === "success" ? (
          <SweepResults sweepResult={sweepResult} />
        ) : null}
      </main>
    </div>
  );
}
