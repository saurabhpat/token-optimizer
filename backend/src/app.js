import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import analyzeRouter from "./routes/analyze.js";
import modelsRouter from "./routes/models.js";

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = env.clientOrigins;

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("This origin is not allowed."));
    }
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/models", modelsRouter);
app.use("/api/analyze", analyzeRouter);

app.use(notFoundHandler);
app.use(errorHandler);
