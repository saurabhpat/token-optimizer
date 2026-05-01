const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number.parseInt(process.env.STATIC_PORT ?? "5173", 10);
const root = path.resolve(__dirname, "../frontend/dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function resolveRequestPath(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath.split("?")[0];
  const normalizedPath = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, "");
  const candidatePath = path.join(root, normalizedPath);

  if (!candidatePath.startsWith(root)) {
    return null;
  }

  if (!fs.existsSync(candidatePath) || fs.statSync(candidatePath).isDirectory()) {
    return path.join(root, "index.html");
  }

  return candidatePath;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || "/");

  if (!filePath) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Server error");
      return;
    }

    response.writeHead(200, {
      "Content-Type":
        mimeTypes[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Static frontend server listening on http://127.0.0.1:${port}`);
});
