import dotenv from "dotenv";

dotenv.config();

const defaultClientOrigin = "http://localhost:5173";

export const env = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL?.trim() ?? "",
  n8nTimeoutMs: Number.parseInt(process.env.N8N_TIMEOUT_MS ?? "30000", 10),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? defaultClientOrigin)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};

export function validateEnvironment() {
  if (!Number.isInteger(env.port) || env.port <= 0) {
    throw new Error("PORT must be a valid positive integer.");
  }

  if (!env.n8nWebhookUrl) {
    throw new Error("N8N_WEBHOOK_URL is required.");
  }

  if (!Number.isInteger(env.n8nTimeoutMs) || env.n8nTimeoutMs <= 0) {
    throw new Error("N8N_TIMEOUT_MS must be a valid positive integer.");
  }
}
