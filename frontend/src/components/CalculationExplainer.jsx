import { Info } from "lucide-react";
import { formatPrice } from "../lib/formatters";

function formatPercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "--";
  }

  return `${Math.round(numericValue <= 1 ? numericValue * 100 : numericValue)}%`;
}

export default function CalculationExplainer({
  selectedModel,
  inputBreakdown,
  result
}) {
  const hasAttachments = Number(inputBreakdown?.attachment_tokens) > 0;
  const outputType = result?.output_type;
  const topRecommendation = Array.isArray(result?.optimization_recommendations)
    ? result.optimization_recommendations[0]
    : null;
  const topConfidence = Number.isFinite(Number(topRecommendation?.confidence_percent))
    ? Number(topRecommendation.confidence_percent)
    : Number.isFinite(Number(topRecommendation?.equivalent_confidence_score))
      ? Number(topRecommendation.equivalent_confidence_score)
      : Number.isFinite(Number(topRecommendation?.confidence_score))
        ? Number(topRecommendation.confidence_score)
        : null;
  const sweepResult = result?.sweep_result;
  const sweepRecommendation = sweepResult?.recommendation;

  const confidenceVal = Number(result?.prediction_confidence);
  const normalizedConfidence = confidenceVal <= 1 ? confidenceVal : confidenceVal / 100;
  let predictabilityLabel = "Low reliability";
  if (normalizedConfidence >= 0.8) {
    predictabilityLabel = "High reliability";
  } else if (normalizedConfidence >= 0.5) {
    predictabilityLabel = "Medium reliability";
  }

  return (
    <details className="rounded-lg border border-border bg-soft px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-ink">
        <Info className="h-4 w-4 text-primary" />
        How this was calculated
      </summary>
      <div className="mt-3 space-y-2 leading-6 text-slate-600">
        <p>
          We count the size of your text and files in tokens, which are just small chunks of text (roughly 3/4 of a word). This helps us estimate how much it will cost to send your message and get an answer.
        </p>
        {hasAttachments ? (
          <p>
            Since you uploaded files, we estimate their size too: reading text files directly, counting PDF pages, measuring image dimensions, or estimating size for other file types.
          </p>
        ) : null}
        <p>
          We predict the type of answer you'll get{outputType ? ` (like a ${outputType.toLowerCase()})` : ""} and estimate how long it will be.
        </p>
        <p>
          If you use a thinking or reasoning mode, the AI uses extra effort to solve complex problems, which adds to the cost even if that thinking process isn't fully shown in the final answer.
        </p>
        <p>
          Estimated Price = (Text sent × input price) + (Estimated answer length × output price). Prices are calculated per 1,000 tokens (pieces of words).
        </p>
        {result?.reasoning_mode_rationale ? (
          <p>{result.reasoning_mode_rationale}</p>
        ) : null}
        {result?.mode_selection_criteria ? (
          <p>{result.mode_selection_criteria}</p>
        ) : null}
        {Number.isFinite(Number(result?.prediction_confidence)) ? (
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="font-semibold text-ink">Estimate reliability</p>
            <p className="mt-1">
              Reliability is <strong className="text-primary">{predictabilityLabel} ({formatPercent(result.prediction_confidence)})</strong>. This tells you how stable the estimated cost is. Cost may vary depending on the actual length of the AI's response.
            </p>
          </div>
        ) : null}
        {topRecommendation ? (
          <div className="rounded-md border border-border bg-white px-3 py-2">
            <p className="font-semibold text-ink">
              Recommended model match quality
            </p>
            <p className="mt-1">
              The recommended model has {topConfidence !== null ? <strong className="text-emerald-600">{formatPercent(topConfidence)} Match Quality</strong> : "a high Match Quality"}. 
              If you switch to this cheaper option, it is {topConfidence !== null ? formatPercent(topConfidence) : "very"} likely to give you the same quality response without losing important details.
            </p>
          </div>
        ) : null}
        {sweepResult?.status === "completed" ? (
          <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
            <p className="font-semibold text-ink">Real-world quality sweep results</p>
            <p className="mt-1">
              We ran a real-world test comparing your selected model against up to three cheaper options. A separate AI model judged the results to see if the cheaper options matched the original quality.
            </p>
            {sweepRecommendation ? (
              <p className="mt-2 font-medium text-emerald-800">
                Best Result: {sweepRecommendation.model} kept{" "}
                {formatPercent(sweepRecommendation.quality_retention_percent)} of the
                original quality while saving{" "}
                {formatPercent(sweepRecommendation.savings_percent)} compared to the original model.
              </p>
            ) : null}
          </div>
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
