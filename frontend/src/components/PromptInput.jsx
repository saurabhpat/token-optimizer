import { useEffect, useRef } from "react";
import { Hash } from "lucide-react";
import { formatNumber } from "../lib/formatters";

export default function PromptInput({
  prompt,
  inputTokens,
  onPromptChange,
  tokenError,
  tokenLabel = "Prompt tokens"
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
  }, [prompt]);

  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="prompt">
            Prompt
          </label>
          <p className="mt-1 text-sm text-slate-500">
            Draft the request you plan to send to the model.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-soft px-3 py-2 text-sm font-semibold text-ink">
          <Hash className="h-4 w-4 text-primary" />
          <span>{formatNumber(inputTokens)}</span>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">
            {tokenLabel}
          </span>
        </div>
      </div>

      <div>
        <label className="sr-only" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          ref={textareaRef}
          id="prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="Describe the task, constraints, tone, and output format you want from the model."
          className="max-h-none min-h-[180px] w-full resize-y overflow-hidden rounded-lg border border-border bg-white px-4 py-3 text-sm leading-6 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        />

        {tokenError ? (
          <p className="mt-2 text-sm font-medium text-rose-600">{tokenError}</p>
        ) : null}
      </div>
    </section>
  );
}
