import { Hash } from "lucide-react";
import { formatNumber } from "../lib/formatters";

export default function PromptInput({
  prompt,
  inputTokens,
  onPromptChange,
  tokenError,
  tokenLabel = "Prompt tokens"
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="prompt">
            Prompt
          </label>
          <p className="mt-1 text-sm text-slate-500">
            Draft the request you plan to send to the model.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-soft px-3 py-2 text-sm font-semibold text-ink">
          <Hash className="h-4 w-4 text-primary" />
          {formatNumber(inputTokens)}
        </div>
      </div>

      <div className="space-y-3">
        <label className="sr-only" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe the task, constraints, tone, and output format you want from the model."
          className="min-h-[220px] w-full resize-none rounded-lg border border-border bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-soft px-3 py-2">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
          <Hash className="h-4 w-4 text-primary" />
          Live token count
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-ink">
              {formatNumber(inputTokens)}
            </p>
            <p className="text-xs text-slate-500">Updated with debounce</p>
            <p className="text-xs text-slate-500">{tokenLabel}</p>
          </div>
        </div>

        {tokenError ? (
          <p className="text-sm font-medium text-rose-600">{tokenError}</p>
        ) : null}
      </div>
    </section>
  );
}
