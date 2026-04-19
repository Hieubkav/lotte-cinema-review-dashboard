const path = require("node:path");
const dotenv = require("dotenv");
const { ConvexHttpClient } = require("convex/browser");

const [, , method = "query", functionName, envFileName = ".env.local", argsJson = "{}"] = process.argv;

if (!functionName) {
  console.error("Usage: node scripts/convex-query.cjs <method> <functionName> [envFileName] [argsJson]");
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
  let result;
  if (method === "query") {
    result = await client.query(functionName, args);
  } else if (method === "mutation") {
    result = await client.mutation(functionName, args);
  } else if (method === "action") {
    result = await client.action(functionName, args);
  } else {
    throw new Error(`Unsupported Convex method: ${method}`);
  }
  process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
