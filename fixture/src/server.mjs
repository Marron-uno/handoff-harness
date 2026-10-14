// Minimal static server for the UI inventory item. Serves public/ on PORT (default 4173).
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const port = Number(process.env.PORT ?? 4173);
createServer((req, res) => {
  const file = join(root, req.url === "/" ? "index.html" : req.url);
  if (!file.startsWith(root) || !existsSync(file)) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": file.endsWith(".html") ? "text/html" : "text/plain" });
  res.end(readFileSync(file));
}).listen(port, () => console.log(`lantern notes on http://localhost:${port}`));
