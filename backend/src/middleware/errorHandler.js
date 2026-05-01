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

export function errorHandler(error, _request, response, _next) {
  const statusCode =
    Number.isInteger(error?.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : 500;

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  response.status(statusCode).json({
    error:
      error instanceof Error && error.message
        ? error.message
        : "Internal server error."
  });
}

