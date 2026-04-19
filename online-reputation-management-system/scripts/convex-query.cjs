const path = require("node:path");
const dotenv = require("dotenv");
const { ConvexHttpClient } = require("convex/browser");

const [, , functionName, envFileName = ".env.local", argsJson = "{}"] = process.argv;

if (!functionName) {
  console.error("Usage: node scripts/convex-query.cjs <functionName> [envFileName] [argsJson]");
  process.exit(1);
}

const envPath = path.join(process.cwd(), envFileName);
dotenv.config({ path: envPath });

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

if (!convexUrl) {
  console.error(`Missing NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) in ${envPath}`);
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function main() {
  const args = JSON.parse(argsJson);
  const result = functionName.includes(":")
    ? await client.query(functionName, args)
    : await client.query(functionName, args);
  process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
