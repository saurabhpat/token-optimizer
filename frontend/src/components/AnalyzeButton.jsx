import { ArrowRight, Loader2 } from "lucide-react";

export default function AnalyzeButton({
  disabled,
  isLoading,
  onClick,
  label = "Analyze prompt",
  loadingLabel = "Analyzing...",
  variant = "primary"
}) {
  const classes =
    variant === "secondary"
      ? "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-5 py-3 text-sm font-semibold text-ink shadow-soft transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
      : "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
      )}
      {isLoading ? loadingLabel : label}
    </button>
  );
}
