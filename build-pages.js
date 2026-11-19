// Builds the free online demo for GitHub Pages into ./docs.
// It saves the model's results so the dashboard works without a server.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboard } from "./model.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const docs = path.join(here, "docs");
fs.mkdirSync(docs, { recursive: true });
fs.copyFileSync(path.join(here, "public", "index.html"), path.join(docs, "index.html"));
fs.writeFileSync(path.join(docs, "dashboard.json"), JSON.stringify(buildDashboard()));
fs.writeFileSync(path.join(docs, ".nojekyll"), "");
console.log("Online demo built in docs/");
