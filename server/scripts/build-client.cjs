const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const clientDir = path.resolve(__dirname, "../../client");

if (!fs.existsSync(path.join(clientDir, "package.json"))) {
  console.error("Client source not found at:", clientDir);
  console.error(
    "Deploy the full repository from its root on deplo.io (remove git-sub-path=server).",
  );
  process.exit(1);
}

execSync("npm install", { cwd: clientDir, stdio: "inherit" });
execSync("npm run build", { cwd: clientDir, stdio: "inherit" });
