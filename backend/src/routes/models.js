import { Router } from "express";
import { fetchOpenRouterModels } from "../services/openRouterService.js";

const router = Router();

router.get("/", async (_request, response, next) => {
  response.set("Cache-Control", "no-store");

  try {
    const models = await fetchOpenRouterModels();
    response.json({ data: models, refreshed_at: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

export default router;
