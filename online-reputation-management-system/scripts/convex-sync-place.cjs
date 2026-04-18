const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { ConvexHttpClient } = require("convex/browser");

const [, , payloadPath] = process.argv;

if (!payloadPath) {
  console.error("Usage: node scripts/convex-sync-place.cjs <payloadPath>");
  process.exit(1);
}

const resolvedPayloadPath = path.resolve(payloadPath);
if (!existsSync(resolvedPayloadPath)) {
  console.error(`Missing payload file: ${resolvedPayloadPath}`);
  process.exit(1);
}

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  process.env.CONVEX_URL ||
  "";

if (!convexUrl) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL (or CONVEX_URL) in .env.local");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);

async function run() {
  const payload = JSON.parse(readFileSync(resolvedPayloadPath, "utf-8"));
  const commands = [
    ["places:upsert", payload.place],
    ["reviews:upsertManyForPlace", payload.reviews],
    ["metrics:upsertForPlace", payload.metrics],
  ];

  for (const [functionName, args] of commands) {
    try {
      await client.mutation(functionName, args);
      process.stdout.write(`[convex-sync] OK ${functionName}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      process.stderr.write(`[convex-sync] FAIL ${functionName}\n${message}\n`);
      process.exit(1);
    }
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[convex-sync] FATAL\n${message}\n`);
  process.exit(1);
});
