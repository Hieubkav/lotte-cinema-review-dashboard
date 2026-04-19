const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const [, , functionName, argsJson = "{}", runnerOverride] = process.argv;

if (!functionName) {
  console.error("Usage: node scripts/convex-run.js <functionName> [argsJson]");
  process.exit(1);
}

const scriptDir = __dirname;
const cwd = process.cwd();
const envBaseDir =
  existsSync(path.join(cwd, ".env.local")) && existsSync(path.join(cwd, "package.json"))
    ? cwd
    : path.resolve(scriptDir, "..");
const envFile = path.join(envBaseDir, ".env.local");
if (!existsSync(envFile)) {
  console.error(`Missing env file: ${envFile}`);
  process.exit(1);
}

function windowsCmd(name) {
  return `C:\\Program Files\\nodejs\\${name}.cmd`;
}

function windowsPs1(name) {
  if (name === "bunx") {
    return path.join(process.env.APPDATA || "", "npm", "bunx.ps1");
  }
  return `C:\\Program Files\\nodejs\\${name}.ps1`;
}

function resolveRunnerCandidates() {
  const localConvex = process.platform === "win32"
    ? path.join(envBaseDir, "node_modules", ".bin", "convex.cmd")
    : path.join(envBaseDir, "node_modules", ".bin", "convex");

  const candidates = [];
  const pushCandidate = (label, command, args = []) => {
    if (!command) return;
    candidates.push({ label, command, args });
  };

  if (runnerOverride && runnerOverride !== "null" && runnerOverride !== "undefined") {
    if (runnerOverride === "bunx") {
      if (process.platform === "win32") {
        pushCandidate("config:bunx", "powershell", ["-ExecutionPolicy", "Bypass", "-File", windowsPs1("bunx"), "convex"]);
      } else {
        pushCandidate("config:bunx", "bunx", ["convex"]);
      }
    } else if (runnerOverride === "npx") {
      if (process.platform === "win32") {
        pushCandidate("config:npx", "powershell", ["-ExecutionPolicy", "Bypass", "-File", windowsPs1("npx"), "convex"]);
      } else {
        pushCandidate("config:npx", "npx", ["convex"]);
      }
    } else {
      pushCandidate("config:path", runnerOverride, []);
    }
  }

  if (existsSync(localConvex)) {
    pushCandidate("local:convex", localConvex, []);
  }
  if (process.platform === "win32") {
    pushCandidate("bunx", "powershell", ["-ExecutionPolicy", "Bypass", "-File", windowsPs1("bunx"), "convex"]);
    pushCandidate("npx", "powershell", ["-ExecutionPolicy", "Bypass", "-File", windowsPs1("npx"), "convex"]);
  } else {
    pushCandidate("bunx", "bunx", ["convex"]);
    pushCandidate("npx", "npx", ["convex"]);
  }

  return candidates;
}

const attempts = [];

try {
  const candidates = resolveRunnerCandidates();

  for (const candidate of candidates) {
    const argv = [
      ...candidate.args,
      "run",
      "--env-file",
      envFile,
      functionName,
      argsJson,
    ];

    const result = spawnSync(candidate.command, argv, {
      cwd: envBaseDir,
      stdio: "pipe",
      shell: true,
      encoding: "utf-8",
    });

    const stdout = result.stdout || "";
    const stderr = result.stderr || "";
    const status = result.status ?? 1;

    attempts.push({
      label: candidate.label,
      command: candidate.command,
      argv,
      status,
      signal: result.signal ?? null,
      stdoutTail: stdout.trim().split(/\r?\n/).slice(-10).join("\n"),
      stderrTail: stderr.trim().split(/\r?\n/).slice(-10).join("\n"),
      error: result.error ? String(result.error) : "",
    });

    if (status === 0) {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      process.exit(0);
    }
  }

  const lines = ["Convex wrapper failed.", "Attempts:"];
  for (const attempt of attempts) {
    lines.push(`- ${attempt.label}`);
    lines.push(`  command: ${attempt.command}`);
    lines.push(`  argv: ${JSON.stringify(attempt.argv)}`);
    lines.push(`  exit: ${attempt.status}${attempt.signal ? ` signal=${attempt.signal}` : ""}`);
    if (attempt.error) lines.push(`  error: ${attempt.error}`);
    if (attempt.stdoutTail) lines.push(`  stdout:\n${attempt.stdoutTail}`);
    if (attempt.stderrTail) lines.push(`  stderr:\n${attempt.stderrTail}`);
  }
  process.stderr.write(`${lines.join("\n")}\n`);
  process.exit(1);
} finally {
}
