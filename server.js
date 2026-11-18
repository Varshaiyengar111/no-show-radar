// A tiny web server with no framework and no outside libraries.
// It trains the model once at start-up and serves the dashboard.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboard } from "./model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3004;
const dashboard = buildDashboard();

http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(here, "public", "index.html"), "utf8"));
  }
  if (req.method === "GET" && req.url === "/api/dashboard") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(dashboard));
  }
  res.writeHead(404).end("Not found");
}).listen(PORT, () => {
  const s = dashboard.summary;
  console.log(`No-Show Radar is running at http://localhost:${PORT}`);
  console.log(`Trained on ${s.history_size - s.test_size} made-up appointments. Test AUC ${s.auc.toFixed(2)}, no-show rate ${(s.base_rate * 100).toFixed(1)}%.`);
});
