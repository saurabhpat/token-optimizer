import { ArrowRight, Gauge, LineChart, Sparkles, WalletCards } from "lucide-react";

const VALUE_PROPS = [
  {
    icon: WalletCards,
    title: "Avoid surprise spend",
    text: "Preview prompt size, likely output size, and estimated cost before sending work to a model."
  },
  {
    icon: LineChart,
    title: "Compare model economics",
    text: "Use live OpenRouter pricing to spot cheaper model choices without losing sight of fit and confidence."
  },
  {
    icon: Sparkles,
    title: "Improve prompts before execution",
    text: "Turn a draft prompt into model-specific optimized versions with token and cost deltas."
  }
];

const STEPS = [
  "Write or paste the prompt you plan to run.",
  "Choose the model and optionally enter a reasoning mode.",
  "Run the backend-native estimate with inferred output type.",
  "Use the recommendation, optimized prompt, mode advice, or cost comparison."
];

export default function AboutView({ onOpenOptimizer }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
            Cost intelligence for LLM work
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink sm:text-5xl">
            Estimate LLM cost before you run.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            TokenOptimizer helps teams sanity-check prompt cost, compare model
            options, and rewrite prompts for better cost-to-quality tradeoffs
            before executing an LLM request.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenOptimizer}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-blue-700"
            >
              Open Optimizer
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <p className="text-sm font-semibold text-ink">Decision preview</p>
              <p className="text-sm text-slate-500">
                Estimate, compare, optimize.
              </p>
            </div>
            <Gauge className="h-6 w-6 text-primary" />
          </div>
          <div className="grid gap-4 py-5 sm:grid-cols-3 lg:grid-cols-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Input
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">Prompt draft</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Analysis
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                Cost projection
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Output
              </p>
              <p className="mt-1 text-2xl font-semibold text-ink">
                Optimized prompt
              </p>
            </div>
          </div>
          <p className="border-t border-border pt-4 text-sm leading-6 text-slate-600">
            The backend keeps provider configuration server-side, while the UI
            focuses on fast comparison and practical next steps.
          </p>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {VALUE_PROPS.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title} className="rounded-lg border border-border bg-white p-5">
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-lg font-semibold text-ink">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {item.text}
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-8 rounded-lg border border-border bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">How it works</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">
              TokenOptimizer keeps the workflow simple: compose the request,
              estimate the usage, compare alternatives, then run the better
              prompt.
            </p>
          </div>
          <ol className="grid flex-1 gap-3 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-soft text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
