export const OUTPUT_GOAL_GROUPS = [
  {
    label: "Text artifacts",
    options: ["Chat", "Agent", "App", "Website", "MCP", "Report/Document"]
  },
  {
    label: "Media artifacts",
    options: ["Image", "Video", "Audiobook"]
  }
];

export const OUTPUT_GOAL_OPTIONS = OUTPUT_GOAL_GROUPS.flatMap(
  (group) => group.options
);

export const MEDIA_OUTPUT_GOALS = new Set(["Image", "Video", "Audiobook"]);
