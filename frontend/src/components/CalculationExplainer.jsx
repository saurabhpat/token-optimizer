import { Info } from "lucide-react";
import { formatPrice } from "../lib/formatters";

export default function CalculationExplainer({
  selectedModel,
  inputBreakdown,
  outputType
}) {
  const hasAttachments = Number(inputBreakdown?.attachment_tokens) > 0;

  return (
    <details className="rounded-lg border border-border bg-soft px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
        <Info className="h-4 w-4 text-primary" />
        How this was calculated
      </summary>
      <div className="mt-3 space-y-2 leading-6 text-slate-600">
        <p>
          Prompt tokens are counted locally in the browser with tiktoken after a
          short debounce.
        </p>
        {hasAttachments ? (
          <p>
            Attachment tokens are estimated locally. Text-like files are counted
            directly, PDFs use extracted text or page-count fallback, images use
            dimensions and a tile estimate, and other file types use a
            low-confidence size-based estimate.
          </p>
        ) : null}
        <p>
          Predicted output is returned by the n8n estimator workflow for the
          selected output modality{outputType ? ` (${outputType})` : ""}. This is a
          planning estimate, not an actual selected-model completion.
        </p>
        <p>
          Estimated cost uses: input tokens x input price / 1,000 plus
          predicted output x output price / 1,000.
        </p>
        {selectedModel ? (
          <p className="text-slate-500">
            Current prices: {formatPrice(selectedModel.input_price)} input and{" "}
            {formatPrice(selectedModel.output_price)} output per 1K tokens.
          </p>
        ) : null}
      </div>
    </details>
  );
}
