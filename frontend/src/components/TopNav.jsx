import { BarChart3 } from "lucide-react";

export default function TopNav({ activeView, onChangeView }) {
  const items = [
    { id: "optimizer", label: "Optimizer" },
    { id: "about", label: "About" }
  ];

  return (
    <header className="border-b border-border bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onChangeView("about")}
          className="flex items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-soft text-primary">
            <BarChart3 className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">
              TokenOptimizer
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">
              Estimate before you execute
            </span>
          </span>
        </button>

        <nav className="flex items-center rounded-lg border border-border bg-soft p-1">
          {items.map((item) => {
            const isActive = item.id === activeView;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-white text-primary shadow-soft"
                    : "text-slate-600 hover:text-ink"
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
