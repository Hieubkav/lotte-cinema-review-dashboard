const { ConvexHttpClient } = require("convex/browser");

async function main() {
  const functionPath = process.argv[2];
  const rawArgs = process.argv[3] ?? process.env.CONVEX_ARGS_JSON ?? "{}";

  if (!functionPath) {
    console.error("Usage: node scripts/convex-preview.cjs <functionPath> [argsJson]");
    process.exit(1);
  }

  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "https://brainy-marten-186.convex.cloud");
  const args = JSON.parse(rawArgs);
  const isMutation = functionPath.includes("cleanup") || functionPath.includes("invoke");
  const result = isMutation
    ? await client.mutation(functionPath, args)
    : await client.query(functionPath, args);

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
