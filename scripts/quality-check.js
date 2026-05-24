const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const checkDirs = [
  "Backend/FieldSync-Backend/index.js",
  "Backend/FieldSync-Backend/config",
  "Backend/FieldSync-Backend/database",
  "Backend/FieldSync-Backend/middleware",
  "Backend/FieldSync-Backend/routes",
  "Backend/FieldSync-Backend/utils",
];

function listJs(target) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return [];

  const stat = fs.statSync(absolute);
  if (stat.isFile()) return absolute.endsWith(".js") ? [absolute] : [];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name);
    return entry.isDirectory() ? listJs(child) : listJs(child);
  });
}

const files = checkDirs.flatMap(listJs);

for (const file of files) {
  execFileSync("node", ["--check", file], { stdio: "inherit" });
}

console.log(`Checked ${files.length} backend JavaScript files.`);
