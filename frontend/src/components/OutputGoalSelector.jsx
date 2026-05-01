import { useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  FileText,
  Globe2,
  Image,
  MessageSquare,
  Music2,
  PanelTop,
  Puzzle,
  Video
} from "lucide-react";
import { OUTPUT_GOAL_GROUPS } from "../constants/outputGoals";

const GOAL_ICONS = {
  Chat: MessageSquare,
  Agent: Bot,
  App: PanelTop,
  Website: Globe2,
  MCP: Puzzle,
  "Report/Document": FileText,
  Image,
  Video,
  Audiobook: Music2
};

export default function OutputGoalSelector({ selectedGoal, onSelectGoal }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const SelectedIcon = GOAL_ICONS[selectedGoal] ?? FileText;

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function handleSelect(goal) {
    onSelectGoal(goal);
    setIsOpen(false);
  }

  return (
    <section className="space-y-2">
      <div>
        <p className="text-sm font-semibold text-ink">Output goal</p>
        <p className="mt-1 text-sm text-slate-500">
          Choose the artifact you want to generate.
        </p>
      </div>

      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          aria-expanded={isOpen}
          className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3 text-left text-sm transition hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:px-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-primary">
              <SelectedIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">
                {selectedGoal}
              </span>
              <span className="block max-w-full truncate text-xs text-slate-500">
                Recommendations follow this goal.
              </span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        </button>

        {isOpen ? (
          <div className="absolute left-0 z-30 mt-2 w-full max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-white p-2 shadow-xl sm:w-96">
            {OUTPUT_GOAL_GROUPS.map((group) => (
              <div key={group.label} className="py-1">
                <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {group.label}
                </p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.options.map((goal) => {
                    const Icon = GOAL_ICONS[goal] ?? FileText;
                    const isSelected = goal === selectedGoal;

                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => handleSelect(goal)}
                        className={[
                          "flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition",
                          isSelected
                            ? "bg-blue-50 font-semibold text-primary"
                            : "text-slate-700 hover:bg-soft hover:text-ink"
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{goal}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
