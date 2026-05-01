function getResponseObject(payload) {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new Error("The analysis service returned an empty payload.");
    }

    return getResponseObject(payload[0]);
  }

  if (payload && typeof payload === "object") {
    if (payload.data && typeof payload.data === "object") {
      return getResponseObject(payload.data);
    }

    if (payload.json && typeof payload.json === "object") {
      return getResponseObject(payload.json);
    }

    return payload;
  }

  throw new Error("The analysis service returned an invalid payload.");
}

export function normalizeAnalysisResponse(payload) {
  const response = getResponseObject(payload);

  const inputTokens = Number(response.input_tokens);
  const predictedOutput = Number(response.predicted_output);
  const estimatedCost = Number(response.estimated_cost);
  const optimizationTip = response.optimization_tip;

  if (!Number.isFinite(inputTokens)) {
    throw new Error("The analysis response is missing input_tokens.");
  }

  if (!Number.isFinite(predictedOutput)) {
    throw new Error("The analysis response is missing predicted_output.");
  }

  if (!Number.isFinite(estimatedCost)) {
    throw new Error("The analysis response is missing estimated_cost.");
  }

  if (typeof optimizationTip !== "string") {
    throw new Error("The analysis response is missing optimization_tip.");
  }

  const normalizedResponse = {
    input_tokens: inputTokens,
    predicted_output: predictedOutput,
    estimated_cost: estimatedCost,
    optimization_tip: optimizationTip.trim()
  };

  for (const key of [
    "predicted_output_min",
    "predicted_output_max",
    "prediction_confidence"
  ]) {
    const numericValue = Number(response[key]);

    if (Number.isFinite(numericValue)) {
      normalizedResponse[key] = numericValue;
    }
  }

  for (const key of ["prediction_method", "prediction_notes"]) {
    if (typeof response[key] === "string" && response[key].trim()) {
      normalizedResponse[key] = response[key].trim();
    }
  }

  for (const key of ["prompt_tokens", "attachment_tokens"]) {
    const numericValue = Number(response[key]);

    if (Number.isFinite(numericValue)) {
      normalizedResponse[key] = numericValue;
    }
  }

  if (typeof response.output_type === "string" && response.output_type.trim()) {
    normalizedResponse.output_type = response.output_type.trim();
  }

  if (Array.isArray(response.input_attachments)) {
    normalizedResponse.input_attachments = response.input_attachments.filter(
      (attachment) => attachment && typeof attachment === "object"
    );
  }

  if (Array.isArray(response.prediction_assumptions)) {
    normalizedResponse.prediction_assumptions =
      response.prediction_assumptions.filter(
        (assumption) => typeof assumption === "string" && assumption.trim()
      );
  }

  return normalizedResponse;
}
