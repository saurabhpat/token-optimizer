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
    input_price: inputPrice,
    output_price: outputPrice,
    context_length: Number.isFinite(Number(model?.context_length))
      ? Number(model.context_length)
      : null,
    input_modalities: normalizeModalities(model?.input_modalities),
    output_modalities: normalizeModalities(model?.output_modalities)
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

  if (/\b(lyria|music|audio|image|video|file|tts|speech|ocr)\b/.test(idAndName)) {
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

function estimateModelCost(model, payload, result, inputTokensOverride) {
  const inputTokens =
    Number.isFinite(inputTokensOverride) && inputTokensOverride >= 0
      ? inputTokensOverride
      : toFiniteNumber(payload.input_tokens);
  const predictedOutput = toFiniteNumber(result.predicted_output);
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

function scoreModelConfidence(model, outputType, promptProfile) {
  const profile = getModelCapabilityProfile(model);
  let score = 0.58;

  if (profile.isStrongGeneral) {
    score += 0.11;
  }

  if (profile.isPremium) {
    score += promptProfile.complexity === "high" ? 0.13 : 0.08;
  }

  if (profile.isLight) {
    score -= promptProfile.complexity === "high" ? 0.14 : 0.06;
  }

  if (profile.isFree) {
    score -= 0.04;
  }

  if (promptProfile.isCode && profile.isCoder) {
    score += 0.11;
  }

  if (promptProfile.isMarketing && profile.isWriting) {
    score += 0.06;
  }

  if (promptProfile.hasManyConstraints && profile.isReasoning) {
    score += 0.06;
  }

  if (promptProfile.isVisual && outputType !== "Image") {
    score -= 0.06;
  }

  if (NON_TEXT_OUTPUT_TYPES.has(outputType) && supportsOutputType(model, outputType)) {
    score += 0.06;
  }

  return Math.min(Math.max(score, 0.45), 0.9);
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
  const mode = `${getModeLabel(selectedOutputType, recommendedIntent)} · ${selectedReasoningMode}`;

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
  const selectedModelId = payload.model;
  const requiredContext =
    originalInputTokens + toFiniteNumber(result.predicted_output) + 512;

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
      const estimatedCost = estimateModelCost(model, payload, result);
      const savings = Number((selectedCost - estimatedCost).toFixed(6));
      const savingsPercent =
        selectedCost > 0 ? Math.max((savings / selectedCost) * 100, 0) : 0;
      const modelProfile = getModelCapabilityProfile(model);
      const confidence = scoreModelConfidence(
        model,
        selectedOutputType,
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
      const optimizedInputTokens = estimatePromptTokens(optimizedPrompt);
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
        mode,
        reasoning_mode: selectedReasoningMode,
        recommended_reasoning_mode: recommendedReasoningMode,
        reasoning_mode_rationale: result.reasoning_mode_rationale,
        mode_selection_criteria: result.mode_selection_criteria,
        mode_cost_delta: Number(
          (
            toFiniteNumber(result.mode_cost_delta_tokens) *
            (model.output_price / 1000)
          ).toFixed(6)
        ),
        estimated_cost: estimatedCost,
        cost_change: Number((estimatedCost - selectedCost).toFixed(6)),
        savings,
        savings_percent: Math.round(savingsPercent),
        confidence_score: Number(confidence.toFixed(2)),
        accuracy: getAccuracyLabel(confidence),
        prompt_change: promptChange,
        prompt_strategy: getPromptStrategy(
          model,
          recommendedIntent,
          selectedOutputType,
          promptProfile
        ) + ` Recommended reasoning mode: ${recommendedReasoningMode}.`,
        optimized_prompt: optimizedPrompt,
        optimized_input_tokens: optimizedInputTokens,
        optimized_token_change: optimizedInputTokens - originalInputTokens,
        optimized_estimated_cost: optimizedEstimatedCost,
        optimized_cost_change: Number(
          (optimizedEstimatedCost - estimatedCost).toFixed(6)
        ),
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
        confidence_basis: [
          modelProfile.isFree ? "free-tier route" : "paid route",
          modelProfile.isPremium
            ? "larger model family"
            : modelProfile.isLight
              ? "lightweight model family"
              : "general model family",
          `${promptProfile.complexity} prompt complexity`,
          `${selectedOutputType} output`,
          `${selectedReasoningMode} reasoning mode`
        ].join(", ")
      };
    })
    .sort((left, right) => {
      if (left.estimated_cost !== right.estimated_cost) {
        return left.estimated_cost - right.estimated_cost;
      }

      return right.confidence_score - left.confidence_score;
    })
    .slice(0, 5);

  const best = recommendations[0];
  const promptRevision = getPromptChange(payload.prompt, selectedOutputType);

  return {
    ...result,
    optimization_tip:
      `${result.optimization_tip} Best ${selectedOutputType} model option: ${best.model} at ${formatCurrency(
        best.estimated_cost
      )}, about ${formatPercent(best.savings_percent)} lower than the selected estimate. Confidence: ${Math.round(
        best.confidence_score * 100
      )}%. Recommended reasoning mode: ${recommendedReasoningMode}. Mode criteria: ${
        result.mode_selection_criteria || "Use the cheapest mode that preserves task reliability."
      } Prompt change: ${promptRevision}`,
    output_type: selectedOutputType,
    artifact_type: recommendedIntent,
    recommended_mode: mode,
    recommended_intent: recommendedIntent,
    recommended_reasoning_mode: recommendedReasoningMode,
    prompt_revision: promptRevision,
    optimized_prompt: best.optimized_prompt,
    optimization_recommendations: recommendations
  };
}
