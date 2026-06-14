export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export function notFoundHandler(_request, response) {
  response.status(404).json({ error: "Route not found." });
}

function redactSensitiveText(value) {
  return typeof value === "string"
    ? value
        .replace(/sk-or-v1-[A-Za-z0-9_-]+/gi, "[redacted_openrouter_key]")
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
        .replace(/OPENROUTER_API_KEY\s*=\s*\S+/gi, "OPENROUTER_API_KEY=[redacted]")
    : value;
}

export function errorHandler(error, _request, response, _next) {
  const statusCode =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : 500;

  if (process.env.NODE_ENV !== "production") {
    const message = redactSensitiveText(error?.stack || error?.message);
    console.error(message || error);
  }

  response.status(statusCode).json({
    error:
      error instanceof Error && error.message
        ? redactSensitiveText(error.message)
        : "Internal server error."
  });
}
