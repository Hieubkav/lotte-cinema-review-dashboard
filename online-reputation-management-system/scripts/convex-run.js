const { spawnSync } = require("node:child_process");

const [, , functionName, argsJson = "{}", ...rest] = process.argv;

if (!functionName) {
  console.error("Usage: node scripts/convex-run.js <functionName> [argsJson]");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["convex", "run", "--env-file", ".env.local", functionName, argsJson, ...rest],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
  }
);

process.exit(result.status ?? 1);
