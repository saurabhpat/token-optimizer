import { FileText, Image, MessageSquare, Music2, Video } from "lucide-react";
import { OUTPUT_GOAL_DETAILS, OUTPUT_GOAL_OPTIONS } from "../constants/outputGoals";

const GOAL_ICONS = {
  Text: MessageSquare,
  File: FileText,
  Image,
  Audio: Music2,
  Video
};

export default function OutputGoalSelector({
  selectedGoal,
  onSelectGoal
}) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Output goal</p>
        <p className="mt-1 text-sm text-slate-500">
          Choose the modality you want the model to generate.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {OUTPUT_GOAL_OPTIONS.map((goal) => {
          const Icon = GOAL_ICONS[goal] ?? FileText;
          const details = OUTPUT_GOAL_DETAILS[goal];
          const isSelected = selectedGoal === goal;

          return (
            <button
              key={goal}
              type="button"
              onClick={() => onSelectGoal(goal)}
              title={`Select ${goal.toLowerCase()} output.`}
              className={[
                "flex min-h-[76px] min-w-0 items-start gap-3 rounded-lg border px-3 py-3 text-left text-sm transition",
                isSelected
                  ? "border-primary bg-blue-50 text-primary shadow-soft"
                  : "border-border bg-white text-slate-700 hover:border-blue-200 hover:bg-soft"
              ].join(" ")}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-current">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{details.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {details.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
