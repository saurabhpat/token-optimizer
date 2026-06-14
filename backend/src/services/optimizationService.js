const OUTPUT_TYPES = new Set(["Text", "File", "Image", "Audio", "Video"]);
const OUTPUT_TYPE_ALIASES = {
  Chat: "Text",
  Agent: "Text",
  App: "Text",
  Website: "Text",
  MCP: "Text",
  "Report/Document": "File",
  Audiobook: "Audio"
};
const NON_TEXT_OUTPUT_TYPES = new Set(["File", "Image", "Audio", "Video"]);
const FREE_MODEL_PATTERN = /(^|[:/\s-])free($|[:/\s-])/i;
const STRONG_GENERAL_MODEL_PATTERN =
  /gpt-4|gpt-5|claude|gemini|mistral|qwen|deepseek|llama|hermes/i;
const LIGHT_MODEL_PATTERN = /mini|flash|lite|haiku|nano|micro|3b|4b|7b|8b/i;
const PREMIUM_MODEL_PATTERN = /pro|sonnet|opus|large|max|405b|480b|70b|120b/i;

function toFiniteNumber(value, fallbackValue = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallbackValue;
}

function normalizeModalities(value) {
  return Array.isArray(value)
    ? value
        .filter((modality) => typeof modality === "string" && modality.trim())
        .map((modality) => modality.trim().toLowerCase())
    : [];
}

function normalizeCandidateModel(model) {
  const id = typeof model?.id === "string" ? model.id.trim() : "";
  const name = typeof model?.name === "string" ? model.name.trim() : id;
  const inputPrice = toFiniteNumber(model?.input_price, NaN);
  const outputPrice = toFiniteNumber(model?.output_price, NaN);

  if (!id || !name || !Number.isFinite(inputPrice) || !Number.isFinite(outputPrice)) {
    return null;
  }

  return {
    id,
    name,
    canonical_slug: typeof model?.canonical_slug === "string" ? model.canonical_slug : "",
    created: Number.isFinite(Number(model?.created)) ? Number(model.created) : null,
    description: typeof model?.description === "string" ? model.description : "",
    input_price: inputPrice,
    output_price: outputPrice,
    context_length: Number.isFinite(Number(model?.context_length))
      ? Number(model.context_length)
      : null,
    input_modalities: normalizeModalities(model?.input_modalities),
    output_modalities: normalizeModalities(model?.output_modalities),
    supported_parameters: Array.isArray(model?.supported_parameters)
      ? model.supported_parameters.filter((parameter) => typeof parameter === "string")
      : [],
    default_parameters:
      model?.default_parameters && typeof model.default_parameters === "object"
        ? model.default_parameters
        : {},
    top_provider:
      model?.top_provider && typeof model.top_provider === "object"
        ? model.top_provider
        : {},
    expiration_date:
      typeof model?.expiration_date === "string" && model.expiration_date.trim()
        ? model.expiration_date.trim()
        : null
  };
}

function normalizeOutputType(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmedValue = value.trim();

  if (OUTPUT_TYPES.has(trimmedValue)) {
    return trimmedValue;
  }

  return OUTPUT_TYPE_ALIASES[trimmedValue] ?? "";
}

function analyzePrompt(prompt, outputType) {
  const text = prompt.toLowerCase();
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  const hasRoleContextTask =
    /\brole\s*:/.test(text) || /\bcontext\s*:/.test(text) || /\btask\s*:/.test(text);
  const hasFormat = /\bformat\s*:|\bjson\b|\btable\b|\bbullets?\b|\bmarkdown\b/.test(text);
  const hasConstraints = /\bconstraint\s*:|\bmust\b|\bdo not\b|\bavoid\b|\bstrictly\b/.test(text);
  const isVisual =
    outputType === "Image" ||
    /\b(image|photo|photograph|render|illustration|poster|visual|camera|lighting|hdr|8k)\b/.test(text);
  const isMarketing =
    /\b(email|landing page|hero|cta|brand|marketing|copy|headline|campaign)\b/.test(text);
  const isCode =
    /\b(app|api|frontend|backend|component|database|schema|typescript|react|node)\b/.test(text);
  const isLong = words.length > 120;
  const hasManyConstraints =
    (text.match(/\bmust\b|\bconstraint\b|\bstrictly\b|\bno\b|\bavoid\b/g) ?? []).length >= 4;

  return {
    wordCount: words.length,
    hasRoleContextTask,
    hasFormat,
    hasConstraints,
    isVisual,
    isMarketing,
    isCode,
    isLong,
    hasManyConstraints,
    complexity:
      words.length > 180 || hasManyConstraints
        ? "high"
        : words.length > 80 || hasRoleContextTask
          ? "medium"
          : "low"
  };
}

function getSelectedOutputType(payload) {
  return normalizeOutputType(payload?.output_type) || normalizeOutputType(payload?.intent) || "Text";
}

function supportsOutputType(model, outputType) {
  const idAndName = `${model.id} ${model.name}`.toLowerCase();

  if (outputType === "Image") {
    return model.output_modalities.includes("image");
  }

  if (outputType === "Video") {
    return model.output_modalities.includes("video");
  }

  if (outputType === "Audio") {
    return (
      model.output_modalities.includes("audio") ||
      model.output_modalities.includes("speech")
    );
  }

  if (outputType === "File") {
    return model.output_modalities.includes("file");
  }

  if (/\b(guard|moderation|embed|embedding|rerank|lyria|music|audio|image|video|file|tts|speech|ocr)\b/.test(idAndName)) {
    return false;
  }

  return (
    model.output_modalities.includes("text") &&
    !model.output_modalities.includes("audio") &&
    !model.output_modalities.includes("image") &&
    !model.output_modalities.includes("video") &&
    !model.output_modalities.includes("file")
  );
}

function isQualityCompatibleOutput(model, outputType) {
  const outputModalities = model.output_modalities;

  if (outputType === "File") {
    return (
      outputModalities.includes("file") ||
      (
        outputModalities.includes("text") &&
        !outputModalities.includes("audio") &&
        !outputModalities.includes("image") &&
        !outputModalities.includes("video")
      )
    );
  }

  return supportsOutputType(model, outputType);
}

function estimateModelCost(model, payload, result, inputTokensOverride, outputTokensOverride) {
  const inputTokens =
    Number.isFinite(inputTokensOverride) && inputTokensOverride >= 0
      ? inputTokensOverride
      : toFiniteNumber(payload.input_tokens);
  const predictedOutput =
    Number.isFinite(outputTokensOverride) && outputTokensOverride >= 0
      ? outputTokensOverride
      : toFiniteNumber(result.predicted_output);
  const textCost =
    inputTokens * (model.input_price / 1000) +
    predictedOutput * (model.output_price / 1000);

  return Number(textCost.toFixed(6));
}

function getModeLabel(outputType, intent) {
  if (outputType === "Image") {
    return "Image generation";
  }

  if (outputType === "Video") {
    return "Video generation";
  }

  if (outputType === "Audio") {
    return "Audio generation";
  }

  if (outputType === "File") {
    return "File generation";
  }

  return intent && intent !== outputType
    ? `${intent} text generation`
    : "Text generation";
}

function getModelCapabilityProfile(model) {
  const idAndName = `${model.id} ${model.name}`.toLowerCase();
  const isFree = FREE_MODEL_PATTERN.test(model.id) || model.id === "openrouter/free";
  const isLight = LIGHT_MODEL_PATTERN.test(idAndName);
  const isPremium = PREMIUM_MODEL_PATTERN.test(idAndName);
  const isStrongGeneral = STRONG_GENERAL_MODEL_PATTERN.test(idAndName);
  const isCoder = /coder|code|devstral|codestral/.test(idAndName);
  const isReasoning = /reason|thinking|r1|qwq|o1|o3|o4/.test(idAndName);
  const isWriting = /claude|gpt|gemini|mistral|hermes|llama/.test(idAndName);

  return {
    isFree,
    isLight,
    isPremium,
    isStrongGeneral,
    isCoder,
    isReasoning,
    isWriting
  };
}

function getAccuracyLabel(confidence) {
  if (confidence >= 0.78) {
    return "High";
  }

  if (confidence >= 0.64) {
    return "Medium";
  }

  return "Budget";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getCostSavingsScore(selectedCost, estimatedCost) {
  if (selectedCost <= 0) {
    return estimatedCost <= 0 ? 0.5 : 0;
  }

  return clamp((selectedCost - estimatedCost) / selectedCost, 0, 1);
}

function getReasoningFitScore(modelProfile, selectedReasoningMode, promptProfile) {
  const modeText = `${selectedReasoningMode}`.toLowerCase();
  const wantsReasoning =
    modeText.includes("thinking") ||
    modeText.includes("reason") ||
    modeText.includes("pro") ||
    modeText.includes("deep") ||
    modeText.includes("high");

  if (wantsReasoning && modelProfile.isReasoning) {
    return 0.9;
  }

  if (wantsReasoning && modelProfile.isPremium) {
    return 0.82;
  }

  if (wantsReasoning && modelProfile.isLight) {
    return 0.48;
  }

  if (promptProfile.hasManyConstraints && modelProfile.isReasoning) {
    return 0.82;
  }

  return 0.72;
}

const CONFIDENCE_FACTORS = {
  capability: 30,
  task: 20,
  reasoning: 20,
  context: 15,
  reliability: 10,
  costRisk: 5
};

function getEquivalentConfidenceLabel(score) {
  if (score >= 90) {
    return "Very likely equivalent";
  }

  if (score >= 80) {
    return "Strong alternative";
  }

  if (score >= 70) {
    return "Reasonable tradeoff";
  }

  if (score >= 55) {
    return "Risky but possibly acceptable";
  }

  return "Not recommended for quality-sensitive use";
}

function getEquivalentRiskLabel(score) {
  if (score >= 80) {
    return "Minimal quality risk";
  }

  if (score >= 70) {
    return "Some quality tradeoff";
  }

  return "High quality risk";
}

function getCandidateReasoningMode(modelProfile, selectedReasoningMode, promptProfile) {
  const modeText = `${selectedReasoningMode}`.toLowerCase();
  const wantsDeepReasoning =
    modeText.includes("pro") ||
    modeText.includes("deep") ||
    modeText.includes("high") ||
    modeText.includes("xhigh") ||
    modeText.includes("extended");
  const wantsThinking =
    wantsDeepReasoning ||
    modeText.includes("thinking") ||
    modeText.includes("reason") ||
    modeText.includes("adaptive");
  const wantsFast =
    modeText.includes("fast") ||
    modeText.includes("low") ||
    modeText.includes("minimal") ||
    modeText.includes("flash");

  if (wantsFast) {
    return "Fast";
  }

  if (wantsDeepReasoning) {
    if (promptProfile.complexity === "high" && (modelProfile.isPremium || modelProfile.isReasoning)) {
      return modelProfile.isReasoning ? "Thinking" : "Pro";
    }

    return "Standard";
  }

  if (wantsThinking) {
    return modelProfile.isReasoning && promptProfile.complexity === "high"
      ? "Thinking"
      : "Standard";
  }

  return "Standard";
}

function getReasoningBucket(mode) {
  const modeText = `${mode}`.toLowerCase();

  if (
    modeText.includes("fast") ||
    modeText.includes("low") ||
    modeText.includes("minimal") ||
    modeText.includes("flash")
  ) {
    return "low";
  }

  if (
    modeText.includes("pro") ||
    modeText.includes("deep") ||
    modeText.includes("high") ||
    modeText.includes("xhigh") ||
    modeText.includes("extended")
  ) {
    return "high";
  }

  if (
    modeText.includes("thinking") ||
    modeText.includes("reason") ||
    modeText.includes("adaptive")
  ) {
    return "thinking";
  }

  return "standard";
}

function estimateCandidateReasoningTokens(result, selectedReasoningMode, candidateMode, promptProfile) {
  const visibleOutputTokens = toFiniteNumber(result.visible_output_tokens);
  const selectedReasoningTokens = toFiniteNumber(result.reasoning_token_estimate);
  const baselineReasoningTokens = selectedReasoningTokens > 0
    ? selectedReasoningTokens
    : Math.ceil(visibleOutputTokens * 0.2);
  const selectedBucket = getReasoningBucket(selectedReasoningMode);
  const candidateBucket = getReasoningBucket(candidateMode);
  const baseByBucket = {
    low: Math.ceil(visibleOutputTokens * 0.08),
    standard: Math.ceil(visibleOutputTokens * 0.18),
    thinking: Math.ceil(visibleOutputTokens * 0.35),
    high: Math.ceil(visibleOutputTokens * 0.55)
  };

  if (candidateBucket === selectedBucket) {
    return baselineReasoningTokens;
  }

  const bucketEstimate = baseByBucket[candidateBucket] ?? baseByBucket.standard;

  if (promptProfile.complexity === "high" && candidateBucket === "low") {
    return Math.max(bucketEstimate, Math.ceil(visibleOutputTokens * 0.12));
  }

  return bucketEstimate;
}

function getFactorBand(earned, max) {
  const ratio = max > 0 ? earned / max : 0;

  if (ratio >= 0.85) {
    return "Strong fit";
  }

  if (ratio >= 0.65) {
    return "Acceptable fit";
  }

  if (ratio >= 0.4) {
    return "Risky fit";
  }

  return "Weak fit";
}

function buildSubScore({ name, earned, max, signal, goodExample, badExample }) {
  const boundedEarned = clamp(earned, 0, max);

  return {
    name,
    earned: Math.round(boundedEarned),
    max,
    band: getFactorBand(boundedEarned, max),
    signal,
    good_example: goodExample,
    bad_example: badExample
  };
}

function buildConfidenceFactor({ key, factor, max, reason, subScores }) {
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);
  const boundedEarned = clamp(earned, 0, max);

  return {
    key,
    factor,
    earned: Math.round(boundedEarned),
    max,
    weight: max,
    band: getFactorBand(boundedEarned, max),
    reason,
    sub_scores: subScores,
    sub_factors: subScores.map(
      (subScore) => `${subScore.name}: ${subScore.signal}`
    )
  };
}

function getCapabilityTier(profile) {
  if (profile.isPremium) {
    return 4;
  }

  if (profile.isStrongGeneral || profile.isReasoning) {
    return 3;
  }

  if (profile.isLight) {
    return 1;
  }

  return 2;
}

function scoreCapabilityMatch(candidateProfile, selectedProfile, promptProfile) {
  const selectedTier = getCapabilityTier(selectedProfile);
  const candidateTier = getCapabilityTier(candidateProfile);
  const tierGap = candidateTier - selectedTier;
  const baselineTierScore =
    tierGap >= 0
      ? 10
      : tierGap === -1
        ? 7
        : tierGap === -2
          ? 4
          : 2;
  const capacityScore =
    candidateProfile.isPremium
      ? 7
      : candidateProfile.isStrongGeneral
        ? 5
        : candidateProfile.isLight
          ? promptProfile.complexity === "high"
            ? 2
            : 4
          : 3;
  const familyScore = candidateProfile.isStrongGeneral ? 4 : 1;
  let specializationScore = 2;

  if (promptProfile.isCode && candidateProfile.isCoder) {
    specializationScore += 2;
  }

  if ((promptProfile.isMarketing || promptProfile.hasFormat) && candidateProfile.isWriting) {
    specializationScore += 1;
  }

  if (promptProfile.hasManyConstraints && candidateProfile.isReasoning) {
    specializationScore += 2;
  }

  const downgradeScore =
    selectedProfile.isPremium && candidateProfile.isLight
      ? promptProfile.complexity === "high"
        ? 0
        : 2
      : candidateProfile.isFree && promptProfile.complexity === "high"
        ? 2
        : 4;
  const subScores = [
    buildSubScore({
      name: "Baseline tier proximity",
      earned: baselineTierScore,
      max: 10,
      signal:
        tierGap >= 0
          ? "Candidate tier is comparable to or stronger than the selected model."
          : "Candidate appears below the selected model tier.",
      goodExample: "Selected premium model compared with another premium or strong general model.",
      badExample: "Selected premium model replaced by a small or lightweight route for a complex prompt."
    }),
    buildSubScore({
      name: "Model capacity",
      earned: capacityScore,
      max: 7,
      signal: candidateProfile.isPremium
        ? "Large or premium model signal."
        : candidateProfile.isLight
          ? "Small or lightweight model signal."
          : "Moderate model capacity signal.",
      goodExample: "Large, premium, or strong general model for a complex synthesis task.",
      badExample: "Tiny or lite model used for long research, code, or report generation."
    }),
    buildSubScore({
      name: "Family signal",
      earned: familyScore,
      max: 4,
      signal: candidateProfile.isStrongGeneral
        ? "Known broad model family, capped at 4 points to avoid family bias."
        : "No strong family signal from model name metadata.",
      goodExample: "Recognized general-purpose family used as a small supporting signal.",
      badExample: "A model is ranked highly only because it shares a familiar family name."
    }),
    buildSubScore({
      name: "Specialization",
      earned: specializationScore,
      max: 5,
      signal: "Credits coding, writing, or reasoning specialization only when the prompt needs it.",
      goodExample: "Coding model for implementation prompts, or reasoning model for constraint-heavy work.",
      badExample: "Generic model receives specialization credit for a task it is not suited for."
    }),
    buildSubScore({
      name: "Downgrade safety",
      earned: downgradeScore,
      max: 4,
      signal: downgradeScore >= 3
        ? "No severe downgrade signal versus the selected baseline."
        : "Candidate may be a meaningful downgrade from the selected baseline.",
      goodExample: "Candidate is not materially weaker than the selected baseline.",
      badExample: "Premium or deep-reasoning baseline replaced by a light/free route."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "capability_match",
    factor: "Capability match",
    max: CONFIDENCE_FACTORS.capability,
    reason:
      earned >= 26
        ? "Candidate capability is close to or stronger than the selected baseline."
        : earned >= 20
          ? "Candidate capability is acceptable, with visible tradeoff risk."
          : earned >= 12
            ? "Candidate capability is risky for preserving the selected model output."
            : "Candidate may be a major downgrade from the selected baseline.",
    subScores
  });
}

function scoreTaskAndOutputFit(model, candidateProfile, promptProfile, outputType) {
  const modalityScore = isQualityCompatibleOutput(model, outputType) ? 7 : 1;
  let taskPatternScore = 3;

  if (promptProfile.isCode && candidateProfile.isCoder) {
    taskPatternScore = 5;
  } else if ((promptProfile.isMarketing || outputType === "File") && candidateProfile.isWriting) {
    taskPatternScore = 5;
  } else if (promptProfile.isVisual && outputType === "Image") {
    taskPatternScore = 5;
  }

  const complexityScore =
    promptProfile.complexity === "high"
      ? candidateProfile.isPremium || candidateProfile.isReasoning
        ? 5
        : candidateProfile.isLight
          ? 1
          : 3
      : candidateProfile.isLight
        ? 4
        : 5;
  const formatScore =
    promptProfile.hasFormat || promptProfile.hasRoleContextTask
      ? candidateProfile.isLight && promptProfile.complexity === "high"
        ? 1
        : 3
      : 2;
  const subScores = [
    buildSubScore({
      name: "Modality and artifact match",
      earned: modalityScore,
      max: 7,
      signal: modalityScore >= 6
        ? `Model metadata fits ${outputType} output.`
        : `Model metadata does not clearly advertise ${outputType} output.`,
      goodExample: "Image model for image output, or text model for text/file-style output.",
      badExample: "Text-only model recommended for image, audio, or video generation."
    }),
    buildSubScore({
      name: "Task pattern match",
      earned: taskPatternScore,
      max: 5,
      signal: "Checks whether model specialization matches coding, writing, visual, or synthesis work.",
      goodExample: "Coding model for implementation; writing/synthesis model for reports.",
      badExample: "No task-specific fit for the inferred prompt pattern."
    }),
    buildSubScore({
      name: "Complexity handling",
      earned: complexityScore,
      max: 5,
      signal: "Checks whether the candidate can handle the prompt length, constraints, and detail level.",
      goodExample: "Premium or reasoning-capable model for high-complexity prompts.",
      badExample: "Lightweight model for a long, high-constraint report or implementation prompt."
    }),
    buildSubScore({
      name: "Format and constraint fit",
      earned: formatScore,
      max: 3,
      signal: "Checks whether the model is likely to follow explicit format and constraint instructions.",
      goodExample: "Structured prompt with tables, sections, citations, or acceptance criteria.",
      badExample: "Model likely to compress or miss strict formatting instructions."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "task_output_fit",
    factor: "Task and output fit",
    max: CONFIDENCE_FACTORS.task,
    reason:
      earned >= 17
        ? "Candidate matches the inferred task and output shape well."
        : earned >= 13
          ? "Candidate can likely handle the task, with some fit uncertainty."
          : "Candidate has weak task or modality fit for this prompt.",
    subScores
  });
}

function scoreReasoningEquivalence(candidateProfile, selectedReasoningMode, candidateMode, promptProfile) {
  const selectedBucket = getReasoningBucket(selectedReasoningMode);
  const candidateBucket = getReasoningBucket(candidateMode);
  const modeMatchScore =
    selectedBucket === candidateBucket
      ? 7
      : selectedBucket === "high" && candidateBucket === "standard"
        ? promptProfile.complexity === "high" ? 3 : 5
        : selectedBucket === "thinking" && candidateBucket === "standard"
          ? promptProfile.hasManyConstraints ? 4 : 6
          : selectedBucket === "standard" && candidateBucket === "low"
            ? 4
            : 5;
  const reasoningSupportScore =
    selectedBucket === "high" || selectedBucket === "thinking"
      ? candidateProfile.isReasoning
        ? 5
        : candidateProfile.isPremium
          ? 4
          : candidateProfile.isLight
            ? 1
            : 3
      : 4;
  const complexityAdequacyScore =
    promptProfile.complexity === "high"
      ? candidateProfile.isReasoning || candidateProfile.isPremium
        ? 5
        : candidateProfile.isLight
          ? 2
          : 3
      : 5;
  const cheaperModeSafetyScore =
    selectedBucket === candidateBucket
      ? 3
      : (selectedBucket === "high" || selectedBucket === "thinking") && candidateBucket === "standard"
        ? promptProfile.complexity === "high"
          ? 1
          : 3
        : candidateBucket === "low"
          ? 1
          : 2;
  const subScores = [
    buildSubScore({
      name: "Mode match",
      earned: modeMatchScore,
      max: 7,
      signal: `Selected mode bucket is ${selectedBucket}; candidate mode bucket is ${candidateBucket}.`,
      goodExample: "Candidate keeps the same mode bucket or safely steps down for simple work.",
      badExample: "Candidate drops from Pro/deep reasoning to low effort for complex work."
    }),
    buildSubScore({
      name: "Reasoning support",
      earned: reasoningSupportScore,
      max: 5,
      signal: "Checks whether the model appears able to support the selected reasoning depth.",
      goodExample: "Reasoning-capable or premium model replacing a high-thinking baseline.",
      badExample: "Lightweight model replacing explicit Pro, Deep, High, or token-budget mode."
    }),
    buildSubScore({
      name: "Prompt complexity adequacy",
      earned: complexityAdequacyScore,
      max: 5,
      signal: "Checks whether reasoning depth is enough for prompt complexity.",
      goodExample: "High-complexity prompt gets reasoning or premium-capacity support.",
      badExample: "High-complexity prompt is routed to a low-effort mode."
    }),
    buildSubScore({
      name: "Cheaper-mode safety",
      earned: cheaperModeSafetyScore,
      max: 3,
      signal: "Rewards cheaper modes only when quality risk looks controlled.",
      goodExample: "Standard mode replaces Pro for a structured prompt with clear requirements.",
      badExample: "Fast or low mode is recommended only because it is cheaper."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "reasoning_mode_equivalence",
    factor: "Reasoning-mode equivalence",
    max: CONFIDENCE_FACTORS.reasoning,
    reason:
      earned >= 17
        ? "Candidate mode is likely enough to preserve the selected mode's useful reasoning behavior."
        : earned >= 13
          ? "Candidate mode may preserve the result, but with some reasoning-depth tradeoff."
          : "Candidate mode is risky for replacing the selected reasoning behavior.",
    subScores
  });
}

function scoreContextSafety(model, requiredContext, originalInputTokens, result) {
  const contextLength = Number.isFinite(Number(model.context_length))
    ? Number(model.context_length)
    : null;
  const expectedOutputTokens = toFiniteNumber(result.predicted_output);
  const ratio = contextLength ? requiredContext / contextLength : null;
  const remaining = contextLength ? contextLength - requiredContext : null;
  const contextOccupancyScore = !contextLength
    ? 3
    : ratio > 0.95
      ? 1
      : ratio > 0.85
        ? 3
        : ratio > 0.65
          ? 5
          : 7;
  const attachmentRoomScore = !contextLength
    ? 2
    : originalInputTokens / contextLength > 0.75
      ? 1
      : originalInputTokens / contextLength > 0.55
        ? 2
        : 4;
  const outputHeadroomScore = !contextLength
    ? 1
    : remaining < expectedOutputTokens * 0.25
      ? 0
      : remaining < expectedOutputTokens
        ? 1
        : 2;
  const metadataCertaintyScore = contextLength ? 2 : 0;
  const subScores = [
    buildSubScore({
      name: "Context occupancy",
      earned: contextOccupancyScore,
      max: 7,
      signal: contextLength
        ? `Estimated request uses ${Math.round((ratio ?? 0) * 100)}% of catalog context.`
        : "Context length is missing from catalog metadata.",
      goodExample: "Prompt, files, answer, and thinking tokens use well under two-thirds of context.",
      badExample: "Request is near or above the model context window."
    }),
    buildSubScore({
      name: "Attachment room",
      earned: attachmentRoomScore,
      max: 4,
      signal: contextLength
        ? `Prompt and attachments use ${Math.round((originalInputTokens / contextLength) * 100)}% of context.`
        : "Attachment safety gets partial credit because context is unknown.",
      goodExample: "Large files still leave enough space for answer and thinking tokens.",
      badExample: "Attachments alone consume most of the candidate context window."
    }),
    buildSubScore({
      name: "Output and reasoning headroom",
      earned: outputHeadroomScore,
      max: 2,
      signal: contextLength
        ? `${Math.max(remaining ?? 0, 0)} estimated tokens remain after prompt, files, answer, and thinking.`
        : "Output headroom is uncertain because context is unknown.",
      goodExample: "Model has room for the estimated answer plus reasoning overhead.",
      badExample: "The answer may be truncated or squeezed by context pressure."
    }),
    buildSubScore({
      name: "Metadata certainty",
      earned: metadataCertaintyScore,
      max: 2,
      signal: contextLength ? "Catalog includes context-length metadata." : "Catalog has no context-length metadata.",
      goodExample: "OpenRouter reports a usable context length.",
      badExample: "No context metadata is available for the model."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "context_attachment_safety",
    factor: "Context and attachment safety",
    max: CONFIDENCE_FACTORS.context,
    reason:
      earned >= 13
        ? "Candidate has enough context room for prompt, attachments, and expected answer."
        : earned >= 10
          ? "Candidate context window is close; long files or answers may be risky."
          : "Candidate context window may not safely fit this request.",
    subScores
  });
}

function scoreReliability(model, candidateProfile) {
  const hasDescription = Boolean(model.description);
  const hasContext = Boolean(model.context_length);
  const hasModalities = model.output_modalities.length > 0;
  const hasSupportedParameters = model.supported_parameters.length > 0;
  const hasPricing = Number.isFinite(model.input_price) && Number.isFinite(model.output_price);
  const expirationTime = model.expiration_date ? Date.parse(model.expiration_date) : null;
  const isExpired = Number.isFinite(expirationTime) && expirationTime < Date.now();
  const completeMetadataScore =
    [hasDescription, hasContext, hasModalities, hasSupportedParameters].filter(Boolean).length >= 3
      ? 3
      : [hasContext, hasModalities, hasSupportedParameters].filter(Boolean).length >= 2
        ? 2
        : 1;
  const stableRouteScore = candidateProfile.isFree ? 1 : 3;
  const pricingScore = hasPricing ? 2 : 0;
  const expirationScore = isExpired ? 0 : model.expiration_date ? 2 : 1;
  const subScores = [
    buildSubScore({
      name: "Complete metadata",
      earned: completeMetadataScore,
      max: 3,
      signal: "Checks description, context, modality, and supported-parameter metadata.",
      goodExample: "Catalog includes context length, modalities, description, and supported parameters.",
      badExample: "Model has sparse metadata, making comparison less trustworthy."
    }),
    buildSubScore({
      name: "Stable route",
      earned: stableRouteScore,
      max: 3,
      signal: candidateProfile.isFree
        ? "Free route can vary by availability, queueing, or provider routing."
        : "Paid or standard route is usually more stable than a free route.",
      goodExample: "Stable paid/provider route.",
      badExample: "Free route with variable routing and availability."
    }),
    buildSubScore({
      name: "Pricing and parameter clarity",
      earned: pricingScore,
      max: 2,
      signal: hasPricing
        ? "Catalog includes usable input and output pricing."
        : "Pricing metadata is missing or unusable.",
      goodExample: "Input and output prices are present for cost comparison.",
      badExample: "Missing pricing forces a weak or incomplete estimate."
    }),
    buildSubScore({
      name: "Non-expired model signal",
      earned: expirationScore,
      max: 2,
      signal: isExpired
        ? "Model expiration date appears to be in the past."
        : model.expiration_date
          ? "Model has a future expiration date."
          : "No expiration date is advertised.",
      goodExample: "Model is not expired or has no deprecation signal.",
      badExample: "Model appears expired or deprecated in catalog metadata."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "reliability_metadata",
    factor: "Reliability and metadata confidence",
    max: CONFIDENCE_FACTORS.reliability,
    reason:
      earned >= 8
        ? "Catalog metadata looks complete enough for a reliable comparison."
        : "Metadata or route reliability is weaker, so comparison confidence is lower.",
    subScores
  });
}

function scoreCostRisk(savingsPercent, candidateProfile, capabilityFactor, attachmentTokens) {
  const meaningfulSavingsScore = savingsPercent >= 50 ? 2 : savingsPercent >= 15 ? 1 : 0;
  const downgradeRiskScore =
    savingsPercent >= 65 && capabilityFactor.earned < 20
      ? 0
      : candidateProfile.isFree && capabilityFactor.earned < 22
        ? 1
        : 2;
  const attachmentSafeScore = Number.isFinite(attachmentTokens) && attachmentTokens >= 0 ? 1 : 0;
  const subScores = [
    buildSubScore({
      name: "Meaningful savings",
      earned: meaningfulSavingsScore,
      max: 2,
      signal: savingsPercent > 0
        ? `${Math.round(savingsPercent)}% estimated savings versus selected model.`
        : "No estimated savings versus selected model.",
      goodExample: "Savings are large enough to justify considering a switch.",
      badExample: "Savings are too small to justify quality risk."
    }),
    buildSubScore({
      name: "Savings without severe downgrade",
      earned: downgradeRiskScore,
      max: 2,
      signal: downgradeRiskScore >= 2
        ? "Savings do not appear to rely on a severe capability downgrade."
        : "Savings may come from a weaker/free route with output-quality risk.",
      goodExample: "Cheaper model remains capable for the prompt.",
      badExample: "Very cheap model looks attractive only because it is much weaker."
    }),
    buildSubScore({
      name: "Attachment-safe math",
      earned: attachmentSafeScore,
      max: 1,
      signal: "Attachment tokens stay included in selected and candidate cost comparisons.",
      goodExample: "Prompt optimization preserves file token cost in the delta.",
      badExample: "Recommendation appears cheaper by accidentally dropping attachment tokens."
    })
  ];
  const earned = subScores.reduce((total, subScore) => total + subScore.earned, 0);

  return buildConfidenceFactor({
    key: "cost_risk_adjustment",
    factor: "Cost-risk adjustment",
    max: CONFIDENCE_FACTORS.costRisk,
    reason:
      earned >= 4
        ? "Savings look meaningful without overwhelming quality risk."
        : "Cost looks attractive, but the discount may come with output-risk tradeoffs.",
    subScores
  });
}

function getAppliedConfidenceGuardrails({
  model,
  candidateProfile,
  selectedProfile,
  promptProfile,
  outputType,
  selectedReasoningMode,
  candidateReasoningMode,
  requiredContext,
  breakdown,
  savingsPercent
}) {
  const task = breakdown.find((factor) => factor.key === "task_output_fit");
  const context = breakdown.find((factor) => factor.key === "context_attachment_safety");
  const capability = breakdown.find((factor) => factor.key === "capability_match");
  const contextLength = Number.isFinite(Number(model.context_length))
    ? Number(model.context_length)
    : null;
  const contextRatio = contextLength ? requiredContext / contextLength : null;
  const selectedBucket = getReasoningBucket(selectedReasoningMode);
  const candidateBucket = getReasoningBucket(candidateReasoningMode);
  const isHighReasoningBaseline = selectedBucket === "high" || selectedBucket === "thinking";
  const guardrails = [];

  if (!isQualityCompatibleOutput(model, outputType)) {
    guardrails.push({
      name: "Modality mismatch cap",
      cap: 55,
      reason: `Candidate metadata does not clearly support ${outputType} output.`
    });
  }

  if ((task && task.earned / task.max < 0.5) || (context && context.earned / context.max < 0.5)) {
    guardrails.push({
      name: "Family cannot rescue weak fit",
      cap: 70,
      reason: "Known model family cannot override weak task or context fit."
    });
  }

  if (selectedProfile.isPremium && (candidateProfile.isLight || candidateProfile.isFree) && promptProfile.complexity === "high") {
    guardrails.push({
      name: "Premium-to-light downgrade cap",
      cap: 75,
      reason: "Selected baseline is premium and candidate is light/free for a complex prompt."
    });
  }

  if (contextRatio !== null && contextRatio > 0.95) {
    guardrails.push({
      name: "Critical context risk cap",
      cap: 55,
      reason: "Prompt, files, expected answer, and thinking tokens nearly exceed the context window."
    });
  } else if (contextRatio !== null && contextRatio > 0.85) {
    guardrails.push({
      name: "Context risk cap",
      cap: 70,
      reason: "Prompt, files, expected answer, and thinking tokens use most of the context window."
    });
  }

  if (!contextLength || !Number.isFinite(model.input_price) || !Number.isFinite(model.output_price)) {
    guardrails.push({
      name: "Missing metadata cap",
      cap: 80,
      reason: "Context or pricing metadata is incomplete, so confidence cannot be too high."
    });
  }

  if (
    isHighReasoningBaseline &&
    (candidateBucket === "low" ||
      (candidateBucket === "standard" && !candidateProfile.isReasoning && !candidateProfile.isPremium))
  ) {
    guardrails.push({
      name: "High reasoning mismatch cap",
      cap: 78,
      reason: "Selected mode asks for deeper reasoning than the candidate mode/model can confidently replace."
    });
  }

  if (
    candidateProfile.isFree &&
    (promptProfile.complexity === "high" || isHighReasoningBaseline) &&
    !(
      capability &&
      task &&
      context &&
      capability.earned / capability.max >= 0.8 &&
      task.earned / task.max >= 0.8 &&
      context.earned / context.max >= 0.8
    )
  ) {
    guardrails.push({
      name: "Free-route reliability cap",
      cap: 85,
      reason: "Free routes can be useful, but complex or high-reasoning prompts need stronger fit signals."
    });
  }

  if (savingsPercent >= 85 && capability && capability.earned / capability.max < 0.65) {
    guardrails.push({
      name: "Suspicious savings cap",
      cap: 72,
      reason: "Very large savings paired with weaker capability may indicate a quality downgrade."
    });
  }

  return guardrails.map((guardrail) => ({
    ...guardrail,
    applied: true
  }));
}

function buildEquivalentConfidence({
  model,
  candidateProfile,
  selectedProfile,
  promptProfile,
  outputType,
  selectedReasoningMode,
  candidateReasoningMode,
  requiredContext,
  originalInputTokens,
  attachmentTokens,
  result,
  savingsPercent
}) {
  const capability = scoreCapabilityMatch(candidateProfile, selectedProfile, promptProfile);
  const task = scoreTaskAndOutputFit(model, candidateProfile, promptProfile, outputType);
  const reasoning = scoreReasoningEquivalence(
    candidateProfile,
    selectedReasoningMode,
    candidateReasoningMode,
    promptProfile
  );
  const context = scoreContextSafety(model, requiredContext, originalInputTokens, result);
  const reliability = scoreReliability(model, candidateProfile);
  const costRisk = scoreCostRisk(savingsPercent, candidateProfile, capability, attachmentTokens);
  const breakdown = [capability, task, reasoning, context, reliability, costRisk];
  const rawScore = clamp(
    breakdown.reduce((total, factor) => total + factor.earned, 0),
    0,
    100
  );
  const guardrails = getAppliedConfidenceGuardrails({
    model,
    candidateProfile,
    selectedProfile,
    promptProfile,
    outputType,
    selectedReasoningMode,
    candidateReasoningMode,
    requiredContext,
    breakdown,
    savingsPercent
  });
  const score = guardrails.reduce(
    (currentScore, guardrail) => Math.min(currentScore, guardrail.cap),
    rawScore
  );
  const label = getEquivalentConfidenceLabel(score);
  const riskLabel = getEquivalentRiskLabel(score);
  const positiveReasons = breakdown
    .filter((factor) => factor.earned / factor.max >= 0.75)
    .map((factor) => factor.reason)
    .slice(0, 2);
  const limitingReasons = breakdown
    .filter((factor) => factor.earned / factor.max < 0.6)
    .map((factor) => factor.reason)
    .slice(0, 1);
  const basis = [
    `${label}: ${riskLabel.toLowerCase()} compared with the selected model baseline.`,
    guardrails.length > 0
      ? `Guardrail applied: ${guardrails[0].reason}`
      : "",
    ...positiveReasons,
    ...limitingReasons
  ].filter(Boolean).join(" ");

  return {
    score: Math.round(score),
    score_before_guardrails: Math.round(rawScore),
    score_decimal: Number((score / 100).toFixed(2)),
    label,
    riskLabel,
    basis,
    breakdown,
    guardrails,
    rankReasonSummary: [
      `${label} for preserving useful output quality.`,
      savingsPercent > 0
        ? `${Math.round(savingsPercent)}% estimated savings versus the selected model.`
        : "No estimated savings versus the selected model.",
      guardrails.length > 0 ? guardrails[0].reason : "",
      ...positiveReasons
    ].filter(Boolean).slice(0, 3)
  };
}

// ─── Simplified 3-Factor Scoring ───────────────────────────────────────────

/**
 * Maps each simplified factor score (0-100) to a label and pill color.
 */
function getFactorPillColor(score) {
  if (score >= 70) return "green";
  if (score >= 45) return "yellow";
  return "red";
}

function getFactorLabel(score, highLabel, midLabel, lowLabel) {
  if (score >= 70) return highLabel;
  if (score >= 45) return midLabel;
  return lowLabel;
}

/**
 * Derives the simplified 3-factor scores from the detailed 6-pillar breakdown.
 *
 * Output Quality Match (60% weight):
 *   Capability Match (30) + Task & Output Fit (20) + Reasoning Mode Equivalence (20)
 *   Normalized to 0-100.
 *
 * Context Safety (25% weight):
 *   Context & Attachment Safety (15) + Reliability & Metadata (10)
 *   Normalized to 0-100.
 *
 * Cost Efficiency (15% weight):
 *   Derived from savings as a fraction of selected cost, clamped 0-100.
 *
 * Blended score applies guardrail caps after combining the three factors.
 */
function computeSimplifiedFactorScores(breakdown, guardrails, selectedCost, candidateCost) {
  const capabilityFactor = breakdown.find((f) => f.key === "capability_match");
  const taskFactor = breakdown.find((f) => f.key === "task_output_fit");
  const reasoningFactor = breakdown.find((f) => f.key === "reasoning_mode_equivalence");
  const contextFactor = breakdown.find((f) => f.key === "context_attachment_safety");
  const reliabilityFactor = breakdown.find((f) => f.key === "reliability_metadata");

  const qualityRawEarned =
    (capabilityFactor?.earned ?? 0) +
    (taskFactor?.earned ?? 0) +
    (reasoningFactor?.earned ?? 0);
  const qualityRawMax = 70; // 30 + 20 + 20
  const qualityMatchScore = Math.round(clamp((qualityRawEarned / qualityRawMax) * 100, 0, 100));

  const contextRawEarned =
    (contextFactor?.earned ?? 0) +
    (reliabilityFactor?.earned ?? 0);
  const contextRawMax = 25; // 15 + 10
  const contextSafetyScore = Math.round(clamp((contextRawEarned / contextRawMax) * 100, 0, 100));

  const savingsFraction =
    selectedCost > 0
      ? clamp((selectedCost - candidateCost) / selectedCost, 0, 1)
      : candidateCost <= 0
        ? 0.5
        : 0;
  const costEfficiencyScore = Math.round(savingsFraction * 100);

  // Weighted blended score before guardrails.
  const rawBlended = Math.round(
    qualityMatchScore * 0.6 +
    contextSafetyScore * 0.25 +
    costEfficiencyScore * 0.15
  );

  // Apply the same guardrail caps to the blended score.
  const blendedScore = guardrails.reduce(
    (score, guardrail) => Math.min(score, guardrail.cap),
    rawBlended
  );

  function getBlendedLabel(score) {
    if (score >= 85) return "Very likely equivalent";
    if (score >= 72) return "Strong alternative";
    if (score >= 58) return "Reasonable tradeoff";
    if (score >= 45) return "Risky";
    return "Not recommended";
  }

  return {
    // Output Quality Match
    quality_match_score: qualityMatchScore,
    quality_match_label: getFactorLabel(qualityMatchScore, "Strong", "Moderate", "Weak"),
    quality_match_color: getFactorPillColor(qualityMatchScore),
    // Context Safety
    context_safety_score: contextSafetyScore,
    context_safety_label: getFactorLabel(contextSafetyScore, "Safe", "Marginal", "Risky"),
    context_safety_color: getFactorPillColor(contextSafetyScore),
    // Cost Efficiency
    cost_efficiency_score: costEfficiencyScore,
    cost_efficiency_label: getFactorLabel(costEfficiencyScore, "High savings", "Moderate savings", "Low savings"),
    cost_efficiency_color: getFactorPillColor(costEfficiencyScore),
    // Blended
    simplified_confidence_score: blendedScore,
    simplified_confidence_label: getBlendedLabel(blendedScore)
  };
}

// ────────────────────────────────────────────────────────────────────────────

function getPromptChange(prompt, outputType) {
  const profile = analyzePrompt(prompt, outputType);

  if (outputType === "Image") {
    return [
      "Use a compact image brief instead of a long role/context/task prompt.",
      "Move the visual hierarchy to the front: subject, viewpoint, composition, light, materials, atmosphere, exclusions.",
      "Replace vague resolution language like 8k with model controls when available: aspect ratio, quality, number of images, and reference strength."
    ].join(" ");
  }

  if (outputType === "Video") {
    return [
      "Split the prompt into scene beats with duration, camera movement, subject action, and transition notes.",
      "Keep style and negative constraints global so they are not repeated in every scene."
    ].join(" ");
  }

  if (outputType === "Audio") {
    return [
      "Specify narrator tone, pacing, pronunciation constraints, and output length separately.",
      "Remove visual-only details unless they affect narration."
    ].join(" ");
  }

  if (outputType === "File") {
    return [
      "State the file type, target length, section outline, audience, and citation/detail expectations up front.",
      "Move supporting context into a short source summary and ask for export-ready structure only where needed."
    ].join(" ");
  }

  if (profile.isMarketing) {
    return [
      "Keep the audience, objective, tone, length, and output format in the first two lines.",
      "Move optional brand context after the required deliverables and cap the answer with a word or bullet count.",
      "For this prompt, add an explicit success criterion such as conversion-focused, executive audience, or beginner-friendly."
    ].join(" ");
  }

  if (profile.isCode) {
    return [
      "Separate functional requirements, constraints, and acceptance checks.",
      "Ask for the smallest useful artifact first, then request tests or edge cases in a second pass if needed.",
      "Name the target stack and output format before implementation details."
    ].join(" ");
  }

  if (profile.isLong) {
    return [
      "Keep hard constraints, remove repeated context, and move examples into a short appendix.",
      "Put the exact output format in the final instruction so the model does not spend tokens negotiating structure."
    ].join(" ");
  }

  return [
    "Add a one-line success criterion and a concrete output format.",
    "Move background context after the task so cheaper models can anchor on the requested deliverable first."
  ].join(" ");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function estimatePromptTokens(prompt) {
  const words = cleanText(prompt).split(/\s+/).filter(Boolean).length;
  return Math.max(Math.ceil(words * 1.35), words > 0 ? 1 : 0);
}

function extractPromptSections(prompt) {
  const labels = [
    "Role",
    "Context",
    "Task",
    "Core Elements",
    "Texture & Light",
    "Atmosphere",
    "Format",
    "Constraint",
    "Constraints",
    "Audience",
    "Tone",
    "Requirements",
    "Output"
  ];
  const pattern = new RegExp(
    `(?:^|\\n|\\r|\\s)(${labels.map(escapeRegex).join("|")}):`,
    "gi"
  );
  const matches = [...prompt.matchAll(pattern)];

  if (matches.length === 0) {
    return {
      brief: cleanText(prompt)
    };
  }

  return matches.reduce((sections, match, index) => {
    const label = match[1].toLowerCase();
    const nextMatch = matches[index + 1];
    const start = match.index + match[0].length;
    const end = nextMatch ? nextMatch.index : prompt.length;
    const value = cleanText(prompt.slice(start, end));

    if (value) {
      sections[label] = value;
    }

    return sections;
  }, {});
}

function getSection(sections, keys) {
  return keys.map((key) => sections[key]).find(Boolean) ?? "";
}

function joinPromptParts(parts) {
  return parts.filter(Boolean).map(cleanText).join("\n");
}

function buildImagePrompt(prompt, modelProfile) {
  const sections = extractPromptSections(prompt);
  const task = getSection(sections, ["task", "brief"]);
  const context = getSection(sections, ["context"]);
  const core = getSection(sections, ["core elements"]);
  const texture = getSection(sections, ["texture & light"]);
  const atmosphere = getSection(sections, ["atmosphere"]);
  const format = getSection(sections, ["format"]);
  const constraints = getSection(sections, ["constraint", "constraints"]);
  const subject = cleanText([task, core].filter(Boolean).join(" "));

  if (modelProfile.isPremium) {
    return joinPromptParts([
      `Create a high-fidelity image from this architectural brief: ${subject || cleanText(prompt)}`,
      context ? `Viewpoint and setting: ${context}` : "",
      texture ? `Materials and light: ${texture}` : "",
      atmosphere ? `Atmosphere: ${atmosphere}` : "",
      format ? `Output style: ${format}` : "",
      constraints ? `Avoid: ${constraints}` : "",
      "Prioritize clean geometry, realistic reflections, accurate landmark scale, and a forward-looking concept-photography feel."
    ]);
  }

  return joinPromptParts([
    `Image prompt: ${subject || cleanText(prompt)}`,
    context ? `Viewpoint: ${context}` : "",
    texture || atmosphere
      ? `Style cues: ${cleanText([texture, atmosphere].filter(Boolean).join(" "))}`
      : "",
    constraints ? `Hard exclusions: ${constraints}` : "",
    "Keep the composition direct, visual-first, and easy for an image model to follow."
  ]);
}

function buildVideoPrompt(prompt, modelProfile) {
  const sections = extractPromptSections(prompt);
  const task = getSection(sections, ["task", "brief"]);
  const context = getSection(sections, ["context"]);
  const constraints = getSection(sections, ["constraint", "constraints"]);

  return joinPromptParts([
    `Video brief: ${task || cleanText(prompt)}`,
    context ? `Setting: ${context}` : "",
    "Scene plan: opening establishing shot, primary subject action, detail shot, closing beat.",
    modelProfile.isPremium
      ? "Add smooth camera movement, consistent lighting, and temporal continuity between beats."
      : "Keep camera movement simple and avoid competing scene changes.",
    constraints ? `Avoid: ${constraints}` : ""
  ]);
}

function buildAudioPrompt(prompt, modelProfile) {
  const sections = extractPromptSections(prompt);
  const task = getSection(sections, ["task", "brief"]);
  const tone = getSection(sections, ["tone"]);
  const constraints = getSection(sections, ["constraint", "constraints"]);

  return joinPromptParts([
    `Audio brief: ${task || cleanText(prompt)}`,
    tone ? `Narration tone: ${tone}` : "Narration tone: natural, clear, and controlled.",
    modelProfile.isPremium
      ? "Preserve emotional pacing, pauses, pronunciation notes, and scene transitions."
      : "Use short sentences, clear pacing, and minimal dramatic variation.",
    constraints ? `Avoid: ${constraints}` : ""
  ]);
}

function buildTextPrompt(prompt, intent, outputType, modelProfile, promptProfile) {
  const sections = extractPromptSections(prompt);
  const task = getSection(sections, ["task", "brief"]);
  const context = getSection(sections, ["context"]);
  const requirements = getSection(sections, ["requirements", "core elements"]);
  const format = getSection(sections, ["format", "output"]);
  const constraints = getSection(sections, ["constraint", "constraints"]);

  return joinPromptParts([
    `Objective: ${task || cleanText(prompt)}`,
    context ? `Context: ${context}` : "",
    requirements ? `Required content: ${requirements}` : "",
    constraints ? `Constraints: ${constraints}` : "",
    outputType === "File"
      ? "File plan: include file type, title, structured sections, key assumptions, and concise next steps."
      : "",
    modelProfile.isCoder
      ? "Execution: provide the smallest complete solution first, then include validation checks and edge cases."
      : "",
    modelProfile.isLight || modelProfile.isFree
      ? "Response budget: be concise, avoid restating the prompt, and prioritize the final answer."
      : "Reasoning depth: preserve nuance, tradeoffs, and assumptions without adding unrelated background.",
    format || promptProfile.hasFormat
      ? `Output format: ${format || "use the requested structure exactly."}`
      : "Output format: concise sections with clear headings."
  ]);
}

function buildOptimizedPrompt(prompt, intent, outputType, model, promptProfile) {
  const modelProfile = getModelCapabilityProfile(model);

  if (outputType === "Image") {
    return buildImagePrompt(prompt, modelProfile);
  }

  if (outputType === "Video") {
    return buildVideoPrompt(prompt, modelProfile);
  }

  if (outputType === "Audio") {
    return buildAudioPrompt(prompt, modelProfile);
  }

  return buildTextPrompt(prompt, intent, outputType, modelProfile, promptProfile);
}

function getPromptStrategy(model, intent, outputType, promptProfile) {
  const modelProfile = getModelCapabilityProfile(model);

  if (outputType === "Image") {
    return modelProfile.isPremium
      ? "Detailed visual prompt with preserved art direction and tighter exclusions"
      : "Compact visual-first prompt tuned for lower-cost image generation";
  }

  if (outputType === "Video") {
    return modelProfile.isPremium
      ? "Scene-beat prompt with continuity, camera movement, and timing"
      : "Short scene plan with one clear action per beat";
  }

  if (outputType === "Audio") {
    return modelProfile.isPremium
      ? "Narration prompt with pacing, tone, and pronunciation control"
      : "Concise narration prompt with simple pacing constraints";
  }

  if (outputType === "File") {
    return "File prompt with target format, section outline, and source/context boundaries";
  }

  if (modelProfile.isCoder) {
    return "Implementation prompt with requirements, constraints, and acceptance checks";
  }

  if (modelProfile.isLight || modelProfile.isFree) {
    return "Compressed prompt with direct objective, strict output shape, and low context overhead";
  }

  return "Structured prompt that keeps nuance while reducing repeated context";
}

function getChangesMade(model, intent, outputType, promptProfile) {
  const modelProfile = getModelCapabilityProfile(model);
  const changes = [];

  if (promptProfile.hasRoleContextTask) {
    changes.push("Converted Role/Context/Task labels into a cleaner execution brief.");
  }

  if (outputType === "Image") {
    changes.push("Moved subject, viewpoint, composition, lighting, and exclusions ahead of background context.");
    changes.push("Replaced generic quality language with image-model controls and concrete visual cues.");
  } else if (outputType === "Video") {
    changes.push("Reframed the request as scene beats with camera and transition guidance.");
  } else if (outputType === "Audio") {
    changes.push("Separated narration tone, pacing, and pronunciation constraints.");
  } else if (outputType === "File") {
    changes.push("Added file structure, target format, audience, and source-boundary guidance.");
  } else {
    changes.push("Separated objective, context, constraints, and output format.");
  }

  if (modelProfile.isLight || modelProfile.isFree) {
    changes.push("Compressed optional context to reduce prompt tokens and improve instruction focus.");
  }

  if (modelProfile.isPremium) {
    changes.push("Preserved nuanced constraints because this model family can use richer direction.");
  }

  return changes.slice(0, 5);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 6
  }).format(value);
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export function enrichAnalysisWithOptimizations(result, payload, candidateModels) {
  const normalizedCandidates = Array.isArray(candidateModels)
    ? candidateModels.map(normalizeCandidateModel).filter(Boolean)
    : [];
  const selectedOutputType = getSelectedOutputType(payload);
  const recommendedIntent = result.artifact_type || payload.intent || selectedOutputType;
  const promptProfile = analyzePrompt(payload.prompt, selectedOutputType);
  const selectedReasoningMode =
    result.reasoning_mode_label ||
    result.reasoning_mode_input ||
    "Auto";
  const recommendedReasoningMode =
    result.recommended_reasoning_mode || selectedReasoningMode;
  const mode = `${getModeLabel(selectedOutputType, recommendedIntent)} - ${selectedReasoningMode}`;

  if (normalizedCandidates.length === 0) {
    return {
      ...result,
      output_type: selectedOutputType,
      recommended_mode: mode,
      recommended_intent: recommendedIntent
    };
  }

  const selectedCost = toFiniteNumber(result.estimated_cost);
  const originalInputTokens = toFiniteNumber(payload.input_tokens);
  const attachmentTokens = toFiniteNumber(payload.attachment_tokens);
  const selectedModelId = payload.model;
  const selectedModel =
    normalizedCandidates.find((model) => model.id === selectedModelId) ?? {
      id: selectedModelId,
      name: selectedModelId,
      input_price: toFiniteNumber(payload.input_price),
      output_price: toFiniteNumber(payload.output_price),
      context_length: null,
      input_modalities: [],
      output_modalities: ["text"],
      supported_parameters: [],
      default_parameters: {},
      top_provider: {},
      expiration_date: null,
      description: "",
      canonical_slug: "",
      created: null
    };
  const selectedProfile = getModelCapabilityProfile(selectedModel);
  const requiredContext =
    originalInputTokens + toFiniteNumber(result.predicted_output) + 512;
  const baselineUsage = {
    baseline_model: selectedModel.id,
    baseline_reasoning_mode: selectedReasoningMode,
    output_type: selectedOutputType,
    artifact_type: recommendedIntent,
    input_tokens: originalInputTokens,
    prompt_tokens: toFiniteNumber(payload.prompt_tokens, originalInputTokens),
    attachment_tokens: attachmentTokens,
    visible_output_tokens: toFiniteNumber(result.visible_output_tokens),
    reasoning_tokens: toFiniteNumber(result.reasoning_token_estimate),
    total_output_tokens: toFiniteNumber(result.predicted_output),
    actual_or_estimated_cost: selectedCost,
    measurement_source: result.baseline_usage?.measurement_source ?? result.prediction_method
  };

  const recommendationCandidates = normalizedCandidates
    .filter((model) => model.id !== selectedModelId)
    .filter(
      (model) =>
        model.context_length === null || model.context_length >= requiredContext
    );

  if (recommendationCandidates.length === 0) {
    return {
      ...result,
      output_type: selectedOutputType,
      recommended_mode: mode,
      recommended_intent: recommendedIntent,
      optimization_recommendations: []
    };
  }

  const recommendations = recommendationCandidates
    .map((model) => {
      const modelProfile = getModelCapabilityProfile(model);
      const candidateReasoningMode = getCandidateReasoningMode(
        modelProfile,
        selectedReasoningMode,
        promptProfile
      );
      const candidateReasoningTokens = estimateCandidateReasoningTokens(
        result,
        selectedReasoningMode,
        candidateReasoningMode,
        promptProfile
      );
      const candidatePredictedOutput =
        toFiniteNumber(result.visible_output_tokens) + candidateReasoningTokens;
      const estimatedCost = estimateModelCost(
        model,
        payload,
        result,
        undefined,
        candidatePredictedOutput
      );
      const savings = Number((selectedCost - estimatedCost).toFixed(6));
      const savingsPercent =
        selectedCost > 0 ? Math.max((savings / selectedCost) * 100, 0) : 0;
      const equivalentConfidence = buildEquivalentConfidence({
        model,
        candidateProfile: modelProfile,
        selectedProfile,
        selectedOutputType,
        outputType: selectedOutputType,
        selectedReasoningMode,
        candidateReasoningMode,
        promptProfile,
        requiredContext,
        originalInputTokens,
        attachmentTokens,
        result,
        savingsPercent
      });
      const costSavingsScore = getCostSavingsScore(selectedCost, estimatedCost);
      const taskFactor = equivalentConfidence.breakdown.find(
        (factor) => factor.key === "task_output_fit"
      );
      const reasoningFactor = equivalentConfidence.breakdown.find(
        (factor) => factor.key === "reasoning_mode_equivalence"
      );
      const taskFitScore = taskFactor ? taskFactor.earned / taskFactor.max : 0;
      const reasoningFitScore = getReasoningFitScore(
        modelProfile,
        candidateReasoningMode,
        promptProfile
      );
      const promptChange = getPromptChange(payload.prompt, selectedOutputType);
      const optimizedPrompt = buildOptimizedPrompt(
        payload.prompt,
        recommendedIntent,
        selectedOutputType,
        model,
        promptProfile
      );
      const optimizedPromptTokens = estimatePromptTokens(optimizedPrompt);
      const optimizedInputTokens = optimizedPromptTokens + attachmentTokens;
      const optimizedEstimatedCost = estimateModelCost(
        model,
        payload,
        result,
        optimizedInputTokens
      );

      return {
        model: model.name,
        model_id: model.id,
        intent: recommendedIntent,
        output_type: selectedOutputType,
        mode: `${getModeLabel(selectedOutputType, recommendedIntent)} - ${candidateReasoningMode}`,
        reasoning_mode: selectedReasoningMode,
        recommended_reasoning_mode: candidateReasoningMode,
        reasoning_mode_rationale: result.reasoning_mode_rationale,
        mode_selection_criteria: result.mode_selection_criteria,
        mode_cost_delta: Number(
          (
            Math.max(
              toFiniteNumber(result.reasoning_token_estimate) - candidateReasoningTokens,
              0
            ) *
            (model.output_price / 1000)
          ).toFixed(6)
        ),
        estimated_cost: estimatedCost,
        cost_change: Number((estimatedCost - selectedCost).toFixed(6)),
        savings,
        savings_percent: Math.round(savingsPercent),
        equivalent_confidence_score: equivalentConfidence.score,
        confidence_percent: equivalentConfidence.score,
        confidence_label: equivalentConfidence.label,
        confidence_basis: equivalentConfidence.basis,
        confidence_score_before_guardrails:
          equivalentConfidence.score_before_guardrails,
        confidence_guardrails: equivalentConfidence.guardrails,
        ...computeSimplifiedFactorScores(
          equivalentConfidence.breakdown,
          equivalentConfidence.guardrails,
          selectedCost,
          estimatedCost
        ),
        confidence_breakdown: equivalentConfidence.breakdown.map((factor) => ({
          key: factor.key,
          factor: factor.factor,
          earned: factor.earned,
          max: factor.max,
          band: factor.band,
          reason: factor.reason,
          sub_factors: factor.sub_factors,
          sub_scores: factor.sub_scores
        })),
        quality_fit_score: equivalentConfidence.score_decimal,
        quality_retention_percent: equivalentConfidence.score,
        quality_delta_percent: equivalentConfidence.score - 100,
        quality_risk_label: equivalentConfidence.riskLabel,
        quality_impact_summary: equivalentConfidence.basis,
        cost_savings_score: Number(costSavingsScore.toFixed(2)),
        task_fit_score: Number(taskFitScore.toFixed(2)),
        reasoning_fit_score: Number(
          (reasoningFactor ? reasoningFactor.earned / reasoningFactor.max : reasoningFitScore).toFixed(2)
        ),
        overall_recommendation_score: equivalentConfidence.score_decimal,
        overall_rank_score: equivalentConfidence.score,
        rank_score_breakdown: {
          overall: {
            label: "Equivalent Output Confidence",
            score_out_of_100: equivalentConfidence.score,
            max_points: 100,
            explanation:
              "Single recommendation score: likely output-equivalence versus the selected model baseline."
          },
          factors: equivalentConfidence.breakdown
        },
        quality_fit_breakdown: equivalentConfidence.breakdown.find(
          (factor) => factor.key === "capability_match"
        ),
        cost_breakdown: equivalentConfidence.breakdown.find(
          (factor) => factor.key === "cost_risk_adjustment"
        ),
        task_fit_breakdown: taskFactor,
        reasoning_fit_breakdown: reasoningFactor,
        ranking_factors: equivalentConfidence.breakdown,
        rank_reason_summary: equivalentConfidence.rankReasonSummary,
        confidence_score: equivalentConfidence.score_decimal,
        accuracy: equivalentConfidence.riskLabel,
        fit_score_label: getAccuracyLabel(equivalentConfidence.score_decimal),
        prompt_change: promptChange,
        prompt_strategy: getPromptStrategy(
          model,
          recommendedIntent,
          selectedOutputType,
          promptProfile
        ) + ` Recommended reasoning mode: ${candidateReasoningMode}.`,
        optimized_prompt: optimizedPrompt,
        optimized_prompt_tokens: optimizedPromptTokens,
        optimized_attachment_tokens: attachmentTokens,
        optimized_input_tokens: optimizedInputTokens,
        optimized_token_change: optimizedInputTokens - originalInputTokens,
        optimized_estimated_cost: optimizedEstimatedCost,
        optimized_cost_change: Number(
          (optimizedEstimatedCost - estimatedCost).toFixed(6)
        ),
        cost_basis: {
          input_tokens: originalInputTokens,
          prompt_tokens: toFiniteNumber(payload.prompt_tokens, originalInputTokens),
          attachment_tokens: attachmentTokens,
          visible_output_tokens: toFiniteNumber(result.visible_output_tokens),
          reasoning_tokens: candidateReasoningTokens,
          total_output_tokens: candidatePredictedOutput,
          input_price: model.input_price,
          output_price: model.output_price,
          estimated_cost: estimatedCost
        },
        baseline_usage: baselineUsage,
        candidate_usage_estimate: {
          input_tokens: originalInputTokens,
          prompt_tokens: toFiniteNumber(payload.prompt_tokens, originalInputTokens),
          attachment_tokens: attachmentTokens,
          visible_output_tokens: toFiniteNumber(result.visible_output_tokens),
          reasoning_tokens: candidateReasoningTokens,
          total_output_tokens: candidatePredictedOutput,
          estimated_cost: estimatedCost,
          reasoning_mode: candidateReasoningMode
        },
        changes_made: getChangesMade(
          model,
          recommendedIntent,
          selectedOutputType,
          promptProfile
        ).concat(
          result.mode_selection_criteria
            ? [`Reasoning mode guidance: ${result.mode_selection_criteria}`]
            : []
        ).slice(0, 6),
        confidence_formula:
          "Equivalent Output Confidence compares candidate capability, task fit, reasoning-mode equivalence, context safety, metadata reliability, and cost-risk against the selected model baseline.",
        confidence_factors: equivalentConfidence.breakdown.map((factor) => ({
          label: factor.factor,
          earned: factor.earned,
          max: factor.max,
          band: factor.band,
          reason: factor.reason,
          sub_factors: factor.sub_factors,
          sub_scores: factor.sub_scores
        }))
      };
    })
    .sort((left, right) => {
      if (left.confidence_percent !== right.confidence_percent) {
        return right.confidence_percent - left.confidence_percent;
      }

      if (left.savings_percent !== right.savings_percent) {
        return right.savings_percent - left.savings_percent;
      }

      return left.estimated_cost - right.estimated_cost;
    })
    .slice(0, 5);

  const best = recommendations[0];
  const promptRevision = getPromptChange(payload.prompt, selectedOutputType);

  return {
    ...result,
    optimization_tip:
      `${result.optimization_tip} Best quality-preserving ${selectedOutputType} option: ${best.model} at ${formatCurrency(
        best.estimated_cost
      )}, about ${formatPercent(best.savings_percent)} lower than the selected estimate with ${best.confidence_percent}% Equivalent Output Confidence. Recommended reasoning mode: ${best.recommended_reasoning_mode}. Mode criteria: ${
        result.mode_selection_criteria || "Use the cheapest mode that preserves task reliability."
      } Prompt change: ${promptRevision}`,
    output_type: selectedOutputType,
    artifact_type: recommendedIntent,
    recommended_mode: mode,
    recommended_intent: recommendedIntent,
    recommended_reasoning_mode: recommendedReasoningMode,
    baseline_usage: result.baseline_usage ?? baselineUsage,
    prompt_revision: promptRevision,
    optimized_prompt: best.optimized_prompt,
    optimization_recommendations: recommendations
  };
}
