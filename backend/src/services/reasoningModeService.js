const LOW_MODE_PATTERN = /\b(none|minimal|fast|flash|low|cheap|economy|lite)\b/i;
const STANDARD_MODE_PATTERN = /\b(standard|default|balanced|medium|normal|auto)\b/i;
const THINKING_MODE_PATTERN = /\b(thinking|reasoning|adaptive|deliberate|reflective)\b/i;
const HIGH_MODE_PATTERN = /\b(pro|deep|high|xhigh|extended|max|maximum|expert|thorough)\b/i;
const TOKEN_BUDGET_PATTERN =
  /(?:budget_tokens|thinking budget|reasoning budget|budget|tokens?)\D{0,12}(\d{2,6})|(\d{2,6})\s*(?:thinking|reasoning)?\s*tokens?/i;

const BUCKETS = {
  low: {
    label: "Fast",
    rate: 0.04,
    min: 0,
    rationale: "Low reasoning overhead for direct, formatting-heavy, or low-risk tasks."
  },
  standard: {
    label: "Standard",
    rate: 0.12,
    min: 24,
    rationale: "Standard reasoning overhead for normal synthesis and planning tasks."
  },
  thinking: {
    label: "Adaptive Thinking",
    rate: 0.24,
    min: 96,
    rationale: "Thinking overhead for multi-step synthesis, constraints, and tradeoffs."
  },
  high: {
    label: "Pro",
    rate: 0.45,
    min: 192,
    rationale: "High reasoning overhead for complex architecture, deep analysis, or high-accuracy work."
  },
  custom: {
    label: "Custom",
    rate: 0.18,
    min: 64,
    rationale: "Custom mode text was accepted and estimated conservatively."
  }
};

function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function clampTokenBudget(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return Math.min(Math.round(numericValue), 200000);
}

function getBucketFromInput(input) {
  if (!input) {
    return "";
  }

  if (LOW_MODE_PATTERN.test(input)) {
    return "low";
  }

  if (HIGH_MODE_PATTERN.test(input)) {
    return "high";
  }

  if (THINKING_MODE_PATTERN.test(input)) {
    return "thinking";
  }

  if (STANDARD_MODE_PATTERN.test(input)) {
    return "standard";
  }

  return "custom";
}

function getRecommendedBucket(promptProfile) {
  return "standard";
}

function getModeSelectionCriteria(selectedBucket, recommendedBucket, promptProfile) {
  if (selectedBucket === recommendedBucket) {
    return `The selected mode matches the ${promptProfile.complexity} complexity and ${promptProfile.artifact_type} artifact profile.`;
  }

  if (selectedBucket === "high" && recommendedBucket !== "high") {
    return "A cheaper mode should preserve similar accuracy because the prompt does not require maximum-depth reasoning for every token.";
  }

  if (selectedBucket === "thinking" && recommendedBucket === "standard") {
    return "Standard mode should be enough unless the answer must resolve ambiguous tradeoffs or hidden constraints.";
  }

  if (selectedBucket === "low" && ["thinking", "high"].includes(recommendedBucket)) {
    return "The prompt appears complex enough that a deeper reasoning mode may improve reliability.";
  }

  return "The recommended mode is based on inferred prompt complexity, artifact type, and expected reasoning depth.";
}

export function parseReasoningMode(input, promptProfile, visibleOutputTokens) {
  const cleanedInput = cleanText(input);
  const explicitBudgetMatch = cleanedInput.match(TOKEN_BUDGET_PATTERN);
  const explicitBudget = explicitBudgetMatch
    ? clampTokenBudget(explicitBudgetMatch[1] ?? explicitBudgetMatch[2])
    : null;
  const selectedBucket = explicitBudget !== null
    ? "custom"
    : getBucketFromInput(cleanedInput) || "standard";
  const recommendedBucket = getRecommendedBucket(promptProfile);
  const selectedProfile = BUCKETS[selectedBucket] ?? BUCKETS.custom;
  const recommendedProfile = BUCKETS[recommendedBucket] ?? BUCKETS.standard;
  const appliesToTokenOutput = !["Image", "Audio", "Video"].includes(
    promptProfile.output_type
  );
  const reasoningTokenEstimate = appliesToTokenOutput
    ? explicitBudget !== null
      ? explicitBudget
      : Math.max(
          selectedProfile.min,
          Math.ceil(Number(visibleOutputTokens) * selectedProfile.rate)
        )
    : 0;
  const recommendedReasoningTokens = appliesToTokenOutput
    ? Math.max(
        recommendedProfile.min,
        Math.ceil(Number(visibleOutputTokens) * recommendedProfile.rate)
      )
    : 0;

  return {
    reasoning_mode_input: cleanedInput,
    reasoning_mode_bucket: selectedBucket,
    reasoning_mode_label: explicitBudget !== null
      ? `Custom ${explicitBudget} token budget`
      : selectedProfile.label,
    recommended_reasoning_mode: recommendedProfile.label,
    recommended_reasoning_mode_bucket: recommendedBucket,
    reasoning_token_estimate: reasoningTokenEstimate,
    recommended_reasoning_token_estimate: recommendedReasoningTokens,
    reasoning_mode_rationale:
      explicitBudget !== null
        ? `Using the explicit reasoning token budget from "${cleanedInput}".`
        : selectedProfile.rationale,
    mode_selection_criteria: getModeSelectionCriteria(
      selectedBucket,
      recommendedBucket,
      promptProfile
    ),
    mode_cost_delta_tokens: reasoningTokenEstimate - recommendedReasoningTokens
  };
}
