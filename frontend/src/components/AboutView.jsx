import { useEffect } from "react";
import {
  ArrowRight,
  Calculator,
  Gauge,
  Layers,
  LineChart,
  Sparkles,
  WalletCards
} from "lucide-react";

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
  },
  {
    icon: Layers,
    title: "See context window usage",
    text: "Instantly check whether your prompt and expected answer fit comfortably inside the model's context window, or if you're near the limit."
  }
];

const STEPS = [
  "Write or paste the prompt you plan to run.",
  "Choose the model and optionally enter a reasoning mode.",
  "Run the backend-native estimate with inferred output type.",
  "Optionally run a quality sweep to measure candidate output against the selected baseline.",
  "Use the recommendation, optimized prompt, mode advice, or cost comparison."
];

const CALCULATION_STEPS = [
  "Prompt and attachment tokens are counted locally in your browser.",
  "The backend reads the prompt and infers the likely output type.",
  "TokenOptimizer estimates the answer size the user will actually see.",
  "Reasoning mode adds extra thinking tokens when Fast, Standard, Thinking, Pro, or a custom token budget is used.",
  "Total output tokens are answer tokens plus any thinking-mode tokens.",
  "The selected model's input and output prices are applied per 1,000 tokens.",
  "Context window usage is calculated by comparing total tokens (input + estimated output) against the model's context limit, shown as used, total, and percentage.",
  "Recommendations compare cheaper model, reasoning mode, and prompt options.",
  "Quality sweep can run the selected baseline and shortlisted candidates, then judge quality retention against a hidden baseline."
];

const CONFIDENCE_FACTORS = [
  {
    factor: "Output Quality Match",
    weight: "60%",
    color: "text-emerald-700",
    meaning:
      "How closely the candidate model's output will match your selected model's quality for this prompt. Combines capability tier, task fit, and reasoning-mode equivalence."
  },
  {
    factor: "Context Safety",
    weight: "25%",
    color: "text-blue-700",
    meaning:
      "Whether the prompt, attachments, expected answer, and thinking tokens fit comfortably inside the candidate's context window, and whether its metadata is reliable."
  },
  {
    factor: "Cost Efficiency",
    weight: "15%",
    color: "text-slate-700",
    meaning:
      "How much cheaper the candidate is relative to the selected model. A bonus signal — not the primary ranking driver."
  }
];


const GUARDRAIL_NOTES = [
  "Models that don't support the inferred output modality are capped at 55.",
  "Models near their context limit are capped at 55–70 depending on how close the fit is.",
  "Premium-to-light switches on complex prompts are capped to prevent over-confidence.",
  "Incomplete pricing or context metadata caps confidence at 80."
];

export default function AboutView({ onOpenOptimizer }) {
  useEffect(() => {
    if (window.location.hash !== "#ranking-guide") {
      return;
    }

    const rankingGuide = document.getElementById("ranking-guide");

    if (rankingGuide) {
      rankingGuide.open = true;
      rankingGuide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <details className="mt-5 rounded-lg border border-border bg-soft px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
            <Calculator className="h-4 w-4 text-primary" />
            How TokenOptimizer calculates cost
          </summary>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]">
            <ol className="grid gap-3 sm:grid-cols-2">
              {CALCULATION_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="text-sm font-semibold text-ink">Simple formula</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Estimated price = input tokens x input price / 1,000 + total
                output tokens x output price / 1,000.
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Total output tokens means the estimated answer tokens plus any
                extra thinking-mode tokens. For media-style outputs, the app
                uses the selected model pricing and a modality-aware estimate
                instead of pretending every output is normal text.
              </p>
            </div>
          </div>
        </details>

        <details
          id="ranking-guide"
          className="mt-4 rounded-lg border border-border bg-soft px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
            <Gauge className="h-4 w-4 text-primary" />
            How confidence ranking works
          </summary>
          <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
            <p>
              Each alternative model is scored on three factors that together
              answer: <em>if I switch from my selected model to this one, how
              closely will the output match?</em> Scores are combined into a
              single blended percentage shown as a progress bar on each
              recommendation card.
            </p>

            {/* 3-factor table */}
            <div className="overflow-x-auto rounded-lg border border-border bg-white">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-soft text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Factor</th>
                    <th className="px-3 py-2 font-semibold">Weight</th>
                    <th className="px-3 py-2 font-semibold">What it measures</th>
                  </tr>
                </thead>
                <tbody>
                  {CONFIDENCE_FACTORS.map((row) => (
                    <tr key={row.factor} className="border-t border-border">
                      <td className={["px-3 py-2 font-semibold", row.color].join(" ")}>
                        {row.factor}
                      </td>
                      <td className="px-3 py-2 font-semibold text-primary">{row.weight}</td>
                      <td className="px-3 py-2">{row.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pill colors */}
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">Pill color guide</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  Green — ≥ 70%
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                  Yellow — 45–69%
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">
                  Red — below 45%
                </span>
              </div>
            </div>

            {/* Decision guide + worked example */}
            <div className="space-y-3">
              {/* Decision guide */}
              <div className="rounded-lg border border-border bg-white p-4">
                <p className="font-semibold text-ink">How to pick a model from the list</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Look at the blended % bar on each card. Use this guide:
                </p>
                <div className="mt-3 space-y-2">
                  {[
                    {
                      range: "85–100%",
                      label: "Very likely equivalent",
                      color: "border-emerald-200 bg-emerald-50 text-emerald-800",
                      badge: "bg-emerald-100 text-emerald-800",
                      decision: "Safe to switch.",
                      tip: "This model is expected to produce output very close to your selected model. Switch confidently, especially for repeating or high-volume tasks."
                    },
                    {
                      range: "72–84%",
                      label: "Strong alternative",
                      color: "border-emerald-100 bg-emerald-50/50 text-emerald-700",
                      badge: "bg-emerald-50 text-emerald-700",
                      decision: "Good choice with minor tradeoffs.",
                      tip: "Output quality will be close. Verify once on a real sample if the task is critical, then switch if it looks good."
                    },
                    {
                      range: "58–71%",
                      label: "Reasonable tradeoff",
                      color: "border-amber-200 bg-amber-50 text-amber-800",
                      badge: "bg-amber-100 text-amber-800",
                      decision: "Use if you’re optimising for cost and can accept some difference.",
                      tip: "The output might be slightly less detailed, shorter, or miss edge-case nuances. Good for draft generation, summaries, or internal tools."
                    },
                    {
                      range: "45–57%",
                      label: "Risky",
                      color: "border-amber-200 bg-amber-50/60 text-amber-700",
                      badge: "bg-amber-50 text-amber-700",
                      decision: "Only use for low-stakes tasks or with manual review.",
                      tip: "Output quality may fall noticeably short. Acceptable for quick summaries, internal drafts, or tasks where a human reviews the output anyway."
                    },
                    {
                      range: "Below 45%",
                      label: "Not recommended",
                      color: "border-rose-200 bg-rose-50 text-rose-800",
                      badge: "bg-rose-100 text-rose-800",
                      decision: "Avoid for this prompt.",
                      tip: "The cost savings likely come at the cost of noticeably different output. The model may not handle the task complexity or output format."
                    }
                  ].map((band) => (
                    <div key={band.range} className={["rounded-lg border p-3", band.color].join(" ")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={["rounded-full px-2.5 py-0.5 text-xs font-bold", band.badge].join(" ")}>
                            {band.range}
                          </span>
                          <span className="text-sm font-semibold">{band.label}</span>
                        </div>
                        <span className="text-xs font-semibold">{band.decision}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 opacity-80">{band.tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worked example */}
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                <p className="font-semibold text-ink">Worked example</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Suppose you selected <strong>Claude Opus</strong> and the app recommends <strong>Mistral Large</strong>:
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex w-28 shrink-0 flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800">
                      <span className="text-sm font-bold">82%</span>
                      <span className="text-[10px] opacity-80">Output Quality</span>
                    </span>
                    <span className="text-slate-400">× 60%</span>
                    <span className="text-slate-600">=&nbsp;<strong>49.2 pts</strong></span>
                    <span className="text-slate-400 text-[10px] hidden sm:block">(how similar the output will be)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex w-28 shrink-0 flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800">
                      <span className="text-sm font-bold">76%</span>
                      <span className="text-[10px] opacity-80">Context Safety</span>
                    </span>
                    <span className="text-slate-400">× 25%</span>
                    <span className="text-slate-600">=&nbsp;<strong>19.0 pts</strong></span>
                    <span className="text-slate-400 text-[10px] hidden sm:block">(prompt + files fit comfortably)</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex w-28 shrink-0 flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-800">
                      <span className="text-sm font-bold">60%</span>
                      <span className="text-[10px] opacity-80">Cost Efficiency</span>
                    </span>
                    <span className="text-slate-400">× 15%</span>
                    <span className="text-slate-600">=&nbsp;<strong>9.0 pts</strong></span>
                    <span className="text-slate-400 text-[10px] hidden sm:block">(how much cheaper it is)</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs">
                    <span className="font-semibold text-ink">Blended score</span>
                    <span className="text-slate-400">=</span>
                    <span className="text-slate-600">49.2 + 19.0 + 9.0</span>
                    <span className="text-slate-400">=</span>
                    <span className="text-sm font-bold text-emerald-700">77%</span>
                    <span className="ml-auto rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                      Strong alternative
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  The final score may be slightly lower if a guardrail applies (e.g. the context window is very tight).
                </p>
              </div>
            </div>

            {/* Guardrails */}
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">Guardrails</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Even a high raw score is capped in these situations:
              </p>
              <ul className="mt-3 space-y-1.5 text-xs leading-5">
                {GUARDRAIL_NOTES.map((note) => (
                  <li key={note} className="flex gap-2">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                    {note}
                  </li>
                ))}
              </ul>
            </div>

            <p className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs leading-5">
              Attachment tokens are always preserved in the recommendation math.
              Cost Efficiency is a 15% bonus signal — the cheapest model never
              automatically ranks first.
            </p>
          </div>
        </details>

        <details className="mt-4 rounded-lg border border-border bg-soft px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-ink">
            <LineChart className="h-4 w-4 text-primary" />
            How quality sweep works
          </summary>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">1. Baseline first</p>
              <p className="mt-2">
                TokenOptimizer runs the selected model and reasoning mode
                through OpenRouter and records actual usage, cost, latency,
                finish reason, and output preview when available.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">2. Shortlist, not the whole catalog</p>
              <p className="mt-2">
                It chooses a small candidate set from the recommendation engine
                using model capability, context safety, modality, and price.
                This avoids multiplying OpenRouter spend.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">3. Blind quality judging</p>
              <p className="mt-2">
                Candidate answers are compared against the selected baseline
                without exposing model names to the judge. The rubric scores
                instruction following, completeness, task quality, structure,
                factual grounding, and brevity.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="font-semibold text-ink">4. Quality-preserving savings</p>
              <p className="mt-2">
                The best option is the model that preserves the most useful
                quality first, then improves cost and latency. The product
                shows measured quality retained and money saved separately.
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
            Quality sweep can consume OpenRouter credits because it runs real
            model calls. File bytes still stay local; the sweep sees attachment
            metadata only unless a future explicit file-upload mode is added.
          </p>
        </details>
      </section>
    </main>
  );
}
