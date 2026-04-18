import { ConvexHttpClient } from "convex/browser";

const [, , functionPath, argsJson = process.env.CONVEX_ARGS_JSON || "{}"] = process.argv;

if (!functionPath) {
  console.error("Usage: node scripts/convex-preview.mjs <functionPath> [argsJson]");
  process.exit(1);
}

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://brainy-marten-186.convex.cloud");

const args = JSON.parse(argsJson);
const method = functionPath.includes(":cleanup") || functionPath.includes(":invoke") ? "mutation" : "query";

const result =
  method === "mutation"
    ? await client.mutation(functionPath, args)
    : await client.query(functionPath, args);

console.log(JSON.stringify(result, null, 2));
