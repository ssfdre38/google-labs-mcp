const { getAsset, isSea } = require("node:sea");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");

function sanitizeArgv(argv, execPath) {
  if (argv.length > 2) {
    const binaryAbs = path.resolve(execPath);
    const arg2Abs = path.resolve(argv[2]);
    if (binaryAbs === arg2Abs) {
      argv.splice(2, 1);
    }
  }
}

function main() {
  if (!isSea()) {
    require("../index.js");
    return;
  }

  sanitizeArgv(process.argv, process.execPath);

  const appDir = path.join(process.env.LOCALAPPDATA || os.tmpdir(), "GoogleLabsMCP", "runtime");
  if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

  const destFile = path.join(appDir, "google-labs-runtime.cjs");
  const codeBuffer = getAsset("bundle.cjs");
  if (!codeBuffer) {
    console.error("Fatal Error: Embedded SEA bundle missing.");
    process.exit(1);
  }

  const newHash = crypto.createHash("sha256").update(Buffer.from(codeBuffer)).digest("hex");
  const hashFile = path.join(appDir, "runtime.sha256");
  let existingHash = "";
  if (fs.existsSync(hashFile)) {
    try { existingHash = fs.readFileSync(hashFile, "utf8").trim(); } catch {}
  }

  if (existingHash !== newHash || !fs.existsSync(destFile)) {
    fs.writeFileSync(destFile, Buffer.from(codeBuffer));
    fs.writeFileSync(hashFile, newHash, "utf8");
  }

  process.env.NODE_SEA_EXEC = "1";
  const req = createRequire(destFile);
  req(destFile);
}

main();
