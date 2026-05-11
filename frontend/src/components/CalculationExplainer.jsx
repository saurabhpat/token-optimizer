import { Info } from "lucide-react";
import { formatPrice } from "../lib/formatters";

export default function CalculationExplainer({
  selectedModel,
  inputBreakdown,
  result
}) {
  const hasAttachments = Number(inputBreakdown?.attachment_tokens) > 0;
  const outputType = result?.output_type;

  return (
    <details className="rounded-lg border border-border bg-soft px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
        <Info className="h-4 w-4 text-primary" />
        How this was calculated
      </summary>
      <div className="mt-3 space-y-2 leading-6 text-slate-600">
        <p>
          Prompt tokens are counted in your browser after a short pause, so the
          app can price the text you are about to send.
        </p>
        {hasAttachments ? (
          <p>
            File tokens are also estimated locally. Text files are counted from
            their content, PDFs use extracted text or a page-count estimate,
            images use their dimensions, and unknown file types use a
            size-based estimate.
          </p>
        ) : null}
        <p>
          TokenOptimizer infers the likely output type
          {outputType ? ` (${outputType})` : ""}. Estimated Output Token Cost is
          the estimated size of the answer you will see, such as a report,
          plan, message, or code response.
        </p>
        <p>
          Thinking mode cost is the extra estimated token usage for modes such
          as Fast, Standard, Thinking, Pro, or an explicit token budget. These
          tokens may not appear in the final answer, but they can still affect
          cost.
        </p>
        <p>
          Estimated price = input tokens x input price / 1,000 + total output
          tokens x output price / 1,000. Total output tokens means answer tokens
          plus any extra thinking tokens.
        </p>
        {result?.reasoning_mode_rationale ? (
          <p>{result.reasoning_mode_rationale}</p>
        ) : null}
        {result?.mode_selection_criteria ? (
          <p>{result.mode_selection_criteria}</p>
        ) : null}
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
