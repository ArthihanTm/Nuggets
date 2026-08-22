const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../../client/dist");
const dest = path.resolve(__dirname, "../public");
const srcIndex = path.join(src, "index.html");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

if (!fs.existsSync(srcIndex)) {
  console.error(
    "Client build missing at client/dist — run npm run build:client first.",
  );
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);
console.log(`Copied client build to ${dest}`);
