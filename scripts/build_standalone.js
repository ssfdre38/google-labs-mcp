const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
if (!fs.existsSync(dist)) fs.mkdirSync(dist, { recursive: true });

console.log("=================================================");
console.log("⚡ Building Standalone Native Binary (Node SEA) ⚡");
console.log("   Target: Google Labs MCP Standalone Engine     ");
console.log("=================================================\n");

// 1. Locate esbuild
const esbuildBin = "C:\\Users\\admin\\source\\gemini-cli-local\\node_modules\\esbuild\\bin\\esbuild";
if (!fs.existsSync(esbuildBin)) {
  console.error("Error: esbuild not found at " + esbuildBin);
  process.exit(1);
}

// 2. Bundle index.js into dist/bundle.cjs
console.log("[1/5] Bundling application with esbuild...");
const bundleOut = path.join(dist, "bundle.cjs");
const buildProc = spawnSync("node", [
  esbuildBin,
  path.join(root, "index.js"),
  "--bundle",
  "--platform=node",
  "--target=node24",
  "--format=cjs",
  `--outfile=${bundleOut}`
], { cwd: root, stdio: "inherit" });

if (buildProc.status !== 0 || !fs.existsSync(bundleOut)) {
  console.error("Error: esbuild failed to generate bundle.cjs");
  process.exit(1);
}

// 3. Write sea-config.json
console.log("[2/5] Writing sea-config.json with embedded asset...");
const seaBlobPath = path.join(dist, "sea-prep.blob");
const seaConfig = {
  main: "sea/sea-entry.cjs",
  output: "dist/sea-prep.blob",
  disableExperimentalSEAWarning: true,
  assets: {
    "bundle.cjs": "dist/bundle.cjs"
  }
};
const seaConfigPath = path.join(root, "sea-config.json");
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2), "utf8");

// 4. Generate SEA Prep Blob
console.log("[3/5] Generating Node SEA prep blob...");
const seaBlob = spawnSync("node", ["--experimental-sea-config", "sea-config.json"], { cwd: root, stdio: "inherit" });
if (seaBlob.status !== 0 || !fs.existsSync(seaBlobPath)) {
  console.error("Error: Failed to generate SEA blob.");
  process.exit(1);
}

// 5. Copy node.exe to dist/google-labs.exe
const targetExe = path.join(dist, "google-labs.exe");
console.log(`[4/5] Copying node.exe to ${targetExe}...`);
fs.copyFileSync(process.execPath, targetExe);

// 5b. Remove signature on Windows before postject injection
const signtool = "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe";
if (fs.existsSync(signtool)) {
  console.log("Removing Windows Authenticode signature from binary...");
  spawnSync(signtool, ["remove", "/s", targetExe], { stdio: "inherit" });
}

// 6. Inject blob with postject
console.log("[5/5] Injecting SEA blob into executable via postject...");
const postjectPath = "C:\\Users\\admin\\AppData\\Local\\npm-cache\\_npx\\c8510be4d849f3b2\\node_modules\\.bin\\postject.cmd";
const fuse = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

const inject = spawnSync(postjectPath, [
  targetExe,
  "NODE_SEA_BLOB",
  seaBlobPath,
  "--sentinel-fuse",
  fuse,
  "--overwrite"
], { cwd: root, stdio: "inherit", shell: true });

if (inject.status !== 0) {
  console.error("Error: postject injection failed.");
  process.exit(1);
}

// Clean up temporary blob and config
if (fs.existsSync(seaConfigPath)) fs.unlinkSync(seaConfigPath);
if (fs.existsSync(seaBlobPath)) fs.unlinkSync(seaBlobPath);

const stats = fs.statSync(targetExe);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);

console.log("\n=================================================");
console.log(`✅ Standalone Executable Ready: ${targetExe} (${sizeMB} MB)`);
console.log("   Runs with zero node_modules and zero dependencies!");
console.log("=================================================\n");
