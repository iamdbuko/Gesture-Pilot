const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcHtml = path.join(root, "src", "ui", "index.html");
const distHtml = path.join(root, "dist", "ui.html");

function copyHtml() {
  fs.mkdirSync(path.dirname(distHtml), { recursive: true });
  fs.copyFileSync(srcHtml, distHtml);
  process.stdout.write(`[watch:html] Copied ${srcHtml} -> ${distHtml}\n`);
}

copyHtml();

fs.watch(srcHtml, { persistent: true }, (event) => {
  if (event === "change") {
    copyHtml();
  }
});
