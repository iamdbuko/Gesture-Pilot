const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcHtml = path.join(root, "src", "ui", "index.html");
const distJs = path.join(root, "dist", "ui.js");
const distHtml = path.join(root, "dist", "ui.html");

const html = fs.readFileSync(srcHtml, "utf8");
const js = fs.readFileSync(distJs, "utf8");

const marker = "<!-- UI_SCRIPT -->";
if (!html.includes(marker)) {
  throw new Error(`Marker ${marker} not found in ${srcHtml}`);
}

const output = html.replace(marker, `<script>\n${js}\n</script>`);

fs.mkdirSync(path.dirname(distHtml), { recursive: true });
fs.writeFileSync(distHtml, output);
process.stdout.write(`[build:html] Wrote ${distHtml}\n`);
