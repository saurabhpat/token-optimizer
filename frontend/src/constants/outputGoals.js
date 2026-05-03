export const OUTPUT_GOAL_OPTIONS = ["Text", "File", "Image", "Audio", "Video"];

export const OUTPUT_GOAL_DETAILS = {
  Text: {
    label: "Text",
    description: "Chat, apps, agents, MCP plans, and website copy."
  },
  File: {
    label: "File",
    description: "Generated documents or downloadable artifacts."
  },
  Image: {
    label: "Image",
    description: "Visual generation and image output models."
  },
  Audio: {
    label: "Audio",
    description: "Speech, narration, music, or audio output."
  },
  Video: {
    label: "Video",
    description: "Motion or video output models."
  }
};

export const NON_TEXT_OUTPUT_GOALS = new Set(["File", "Image", "Audio", "Video"]);

export const LEGACY_OUTPUT_GOAL_ALIASES = {
  Chat: "Text",
  Agent: "Text",
  App: "Text",
  Website: "Text",
  MCP: "Text",
  "Report/Document": "File",
  Audiobook: "Audio"
};

export function normalizeOutputGoal(value) {
  if (OUTPUT_GOAL_OPTIONS.includes(value)) {
    return value;
  }

  return LEGACY_OUTPUT_GOAL_ALIASES[value] ?? "Text";
}
