import { Router } from "express";
import { fetchOpenRouterModels } from "../services/openRouterService.js";

const router = Router();

router.get("/", async (_request, response, next) => {
  try {
    const models = await fetchOpenRouterModels();
    response.json({ data: models });
  } catch (error) {
    next(error);
  }
});

export default router;

