const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

function getErrorMessage(data, fallbackMessage) {
  return typeof data?.error === "string" && data.error.trim()
    ? data.error
    : fallbackMessage;
}

function isValidAnalysisPayload(payload) {
  return (
    payload &&
    Number.isFinite(payload.input_tokens) &&
    Number.isFinite(payload.predicted_output) &&
    Number.isFinite(payload.estimated_cost) &&
    typeof payload.optimization_tip === "string" &&
    (payload.optimization_recommendations === undefined ||
      Array.isArray(payload.optimization_recommendations))
  );
}

function isValidModelPayload(payload) {
  return (
    payload &&
    typeof payload.id === "string" &&
    typeof payload.name === "string" &&
    Number.isFinite(payload.input_price) &&
    Number.isFinite(payload.output_price)
  );
}

export async function fetchModels() {
  const response = await fetch(`${API_BASE_URL}/api/models`);

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("The model catalog returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Unable to load models right now."));
  }

  if (!Array.isArray(data?.data)) {
    throw new Error("The model catalog response is incomplete.");
  }

  const models = data.data.filter(isValidModelPayload);

  if (models.length === 0) {
    throw new Error("No billable OpenRouter models are currently available.");
  }

  return models;
}

export async function analyzePrompt(payload) {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, "Unable to analyze the prompt right now."));
  }

  if (!isValidAnalysisPayload(data)) {
    throw new Error("The analysis response is incomplete.");
  }

  return data;
}
