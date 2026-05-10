const OUTPUT_TYPES = new Set(["Text", "File", "Image", "Audio", "Video"]);

function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
}

function getWordCount(prompt) {
  return cleanText(prompt).split(/\s+/).filter(Boolean).length;
}

function hasAny(text, pattern) {
  return pattern.test(text);
}

function getMatchCount(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function getPromptComplexity(text, wordCount) {
  const constraintCount = (text.match(/\b(must|strictly|avoid|constraint|do not|only|never)\b/g) ?? []).length;
  const hasStructuredBrief = /\b(role|context|task|format|constraints?|requirements?)\s*:/.test(text);
  const hasImplementationScope =
    /\b(api|database|schema|backend|frontend|architecture|implementation|workflow|integration)\b/.test(text);

  if (wordCount > 180 || constraintCount >= 5 || (wordCount > 100 && hasImplementationScope)) {
    return "high";
  }

  if (wordCount > 70 || constraintCount >= 2 || hasStructuredBrief || hasImplementationScope) {
    return "medium";
  }

  return "low";
}

function inferArtifactType(text) {
  const reportSignalCount =
    getMatchCount(
      text,
      /\b(report|whitepaper|document|proposal|brief|case study|research paper|research|pdf|docx|deck|slides|spreadsheet|csv|xlsx|comparison table|column headers?|headers?|resources? with links?|verification links?|citations?|references?|learning and development budget|lookup platforms?)\b/g
    ) +
    (/\boutput\s+of\s+the\s+file\b/.test(text) ? 2 : 0) +
    (/\bformat\s*:[\s\S]{0,220}\b(document|comparison table|column headers?|headers?)\b/.test(text)
      ? 2
      : 0);

  if (reportSignalCount >= 2) {
    return "Report";
  }

  if (hasAny(text, /\b(agent|multi-agent|workflow agent|autonomous)\b/)) {
    return "Agent";
  }

  if (hasAny(text, /\b(mcp|model context protocol|tool server)\b/)) {
    return "MCP";
  }

  if (
    hasAny(
      text,
      /\b(build|design|develop|implement|create|architect|scaffold|prototype|launch)\b[\s\S]{0,80}\b(app|application|dashboard|saas|product|feature|frontend|backend|full-stack|fullstack)\b|\b(app|application|dashboard|saas|product|feature|frontend|backend|full-stack|fullstack)\b[\s\S]{0,80}\b(plan|implementation|prototype|build|design|develop|create)\b/
    )
  ) {
    return "App";
  }

  if (hasAny(text, /\b(website|landing page|web page|homepage|site|portfolio)\b/)) {
    return "Website";
  }

  if (reportSignalCount > 0) {
    return "Report";
  }

  if (hasAny(text, /\b(chat|answer|reply|conversation|message)\b/)) {
    return "Chat";
  }

  return "General";
}

function inferOutputType(text, artifactType, attachments) {
  if (hasAny(text, /\b(video|animation|animated|motion|clip|film|storyboard|scene beats?|camera movement|shot list)\b/)) {
    return "Video";
  }

  if (hasAny(text, /\b(audio|audiobook|voice|speech|narration|narrator|podcast|music|soundtrack|tts)\b/)) {
    return "Audio";
  }

  if (hasAny(text, /\b(image|photo|photograph|render|illustration|poster|visual|logo|graphic|thumbnail|hdr|8k|camera angle)\b/)) {
    return "Image";
  }

  if (
    artifactType === "Report" &&
    hasAny(
      text,
      /\b(file|pdf|docx|document|spreadsheet|csv|xlsx|deck|slides|downloadable|export|comparison table|column headers?|headers?|resources? with links?|verification links?|citations?|references?|research)\b/
    )
  ) {
    return "File";
  }

  const hasFileAttachment = attachments.some((attachment) =>
    ["document", "pdf", "text", "generic"].includes(attachment.type)
  );

  if (hasFileAttachment && hasAny(text, /\b(summarize|extract|analyze|convert|turn this into|create a document)\b/)) {
    return "File";
  }

  return "Text";
}

function estimateVisibleOutputTokens(profile) {
  const { output_type: outputType, artifact_type: artifactType, input_tokens: inputTokens, word_count: wordCount, complexity } = profile;

  if (["Image", "Audio", "Video"].includes(outputType)) {
    return 0;
  }

  const complexityMultiplier = complexity === "high" ? 1.35 : complexity === "medium" ? 1.05 : 0.82;
  const inputBasedEstimate = Math.ceil(inputTokens * (complexity === "high" ? 1.45 : complexity === "medium" ? 1.05 : 0.65));
  const wordBasedEstimate = Math.ceil(wordCount * (complexity === "high" ? 6.2 : complexity === "medium" ? 4.6 : 3.2));

  const minimumByArtifact = {
    Agent: 1500,
    App: 1600,
    Website: 1200,
    MCP: 1400,
    Report: outputType === "File" ? 2200 : 1800,
    Chat: 240,
    General: 500
  };

  const maximumByArtifact = {
    Agent: 5200,
    App: 5800,
    Website: 4200,
    MCP: 4600,
    Report: outputType === "File" ? 7000 : 5600,
    Chat: 1600,
    General: 3600
  };

  const minimum = minimumByArtifact[artifactType] ?? minimumByArtifact.General;
  const maximum = maximumByArtifact[artifactType] ?? maximumByArtifact.General;
  const estimate = Math.ceil(Math.max(minimum, inputBasedEstimate, wordBasedEstimate) * complexityMultiplier);

  return Math.min(estimate, maximum);
}

function getPredictionRange(visibleOutputTokens, outputType, complexity) {
  if (["Image", "Audio", "Video"].includes(outputType)) {
    return { min: 0, max: 0 };
  }

  const spread = complexity === "high" ? 0.35 : complexity === "medium" ? 0.26 : 0.2;

  return {
    min: Math.max(1, Math.floor(visibleOutputTokens * (1 - spread))),
    max: Math.ceil(visibleOutputTokens * (1 + spread))
  };
}

export function inferPromptProfile(payload) {
  const prompt = cleanText(payload?.prompt);
  const text = prompt.toLowerCase();
  const attachments = Array.isArray(payload?.input_attachments)
    ? payload.input_attachments
    : [];
  const inputTokens = Number.isFinite(Number(payload?.input_tokens))
    ? Number(payload.input_tokens)
    : 0;
  const wordCount = getWordCount(prompt);
  const complexity = getPromptComplexity(text, wordCount);
  const initialArtifactType = inferArtifactType(text);
  const outputType = inferOutputType(text, initialArtifactType, attachments);
  const artifactType = ["Image", "Audio", "Video"].includes(outputType)
    ? outputType
    : initialArtifactType;
  const visibleOutputTokens = estimateVisibleOutputTokens({
    output_type: outputType,
    artifact_type: artifactType,
    input_tokens: inputTokens,
    word_count: wordCount,
    complexity
  });
  const range = getPredictionRange(visibleOutputTokens, outputType, complexity);

  return {
    output_type: OUTPUT_TYPES.has(outputType) ? outputType : "Text",
    artifact_type: artifactType,
    complexity,
    word_count: wordCount,
    visible_output_tokens: visibleOutputTokens,
    predicted_output_min: range.min,
    predicted_output_max: range.max,
    inference_notes: [
      `${artifactType} artifact inferred from prompt language.`,
      `${outputType} output modality inferred from prompt and attachment metadata.`,
      `${complexity} prompt complexity based on length, constraints, and implementation scope.`
    ]
  };
}
