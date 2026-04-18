const { spawnSync } = require("node:child_process");
const { existsSync, writeFileSync, rmSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const [, , functionName, argsJson = "{}", ...rest] = process.argv;

if (!functionName) {
  console.error("Usage: node scripts/convex-run.js <functionName> [argsJson]");
  process.exit(1);
}

const npxCmd =
  process.platform === "win32"
    ? "C:\\Program Files\\nodejs\\npx.cmd"
    : "npx";

const envFile = path.join(process.cwd(), ".env.local");
if (!existsSync(envFile)) {
  console.error(`Missing env file: ${envFile}`);
  process.exit(1);
}

const payloadFile = path.join(
  os.tmpdir(),
  `convex-run-${process.pid}-${Date.now()}.json`
);
writeFileSync(payloadFile, argsJson, "utf-8");

const runnerCode = `
const fs = require("fs");
const { spawnSync } = require("node:child_process");
const cwd = process.argv[1];
const npx = process.argv[2];
const fn = process.argv[3];
const payloadPath = process.argv[4];
const extra = process.argv.slice(5);
const payload = fs.readFileSync(payloadPath, "utf-8");
const res = spawnSync(npx, ["convex", "run", "--env-file", ".env.local", fn, payload, ...extra], {
  cwd,
  stdio: "pipe",
  shell: false,
  encoding: "utf-8",
});
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
process.exit(res.status ?? 1);
`;

const result = spawnSync(
  process.execPath,
  ["-e", runnerCode, process.cwd(), npxCmd, functionName, payloadFile, ...rest],
  {
    cwd: process.cwd(),
    stdio: "pipe",
    shell: false,
    encoding: "utf-8",
  }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if ((result.status ?? 1) !== 0 && !result.stdout && !result.stderr) {
  process.stderr.write("Convex wrapper failed without stdout/stderr output.\n");
}
rmSync(payloadFile, { force: true });

process.exit(result.status ?? 1);
