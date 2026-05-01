const http = require("http");

const port = Number.parseInt(process.env.MOCK_WEBHOOK_PORT ?? "3001", 10);

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const payload = await parseBody(request);
    const inputTokens = Number(payload.input_tokens ?? 0);
    const inputPrice = Number(payload.input_price ?? 0);
    const outputPrice = Number(payload.output_price ?? 0);
    const predictedOutput = Math.max(Math.ceil(inputTokens * 0.65), 32);
    const estimatedCost = Number(
      (
        (inputTokens * inputPrice + predictedOutput * outputPrice) /
        1000
      ).toFixed(6)
    );

    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        input_tokens: inputTokens,
        predicted_output: predictedOutput,
        estimated_cost: estimatedCost,
        optimization_tip:
          "Combine repeated context into one compact block and move format rules to the end of the prompt."
      })
    );
  } catch {
    response.writeHead(400, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Invalid JSON payload." }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Mock webhook listening on http://127.0.0.1:${port}/`);
});
