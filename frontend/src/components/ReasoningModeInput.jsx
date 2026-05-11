import { BrainCircuit } from "lucide-react";

export default function ReasoningModeInput({ value, onChange }) {
  return (
    <section className="space-y-2">
      <div>
        <label
          className="text-sm font-semibold text-ink"
          htmlFor="reasoning-mode"
        >
          Reasoning mode
        </label>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">
          Optional estimation hint for thinking or pro modes.
        </p>
      </div>

      <div className="flex items-center rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-ink transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 sm:px-4">
        <BrainCircuit className="mr-3 h-4 w-4 shrink-0 text-primary" />
        <input
          id="reasoning-mode"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Fast, Pro, Thinking, Adaptive Thinking, budget_tokens=2048"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
        />
      </div>
    </section>
  );
}
