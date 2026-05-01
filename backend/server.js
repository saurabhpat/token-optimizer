import { app } from "./src/app.js";
import { env, validateEnvironment } from "./src/config/env.js";

try {
  validateEnvironment();

  app.listen(env.port, () => {
    console.log(`TokenOptimizer backend listening on port ${env.port}`);
  });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to start the server."
  );
  process.exit(1);
}

