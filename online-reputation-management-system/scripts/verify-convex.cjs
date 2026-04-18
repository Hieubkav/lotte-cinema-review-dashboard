const { ConvexHttpClient } = require("convex/browser");

async function main() {
  const client = new ConvexHttpClient("https://brainy-marten-186.convex.cloud");
  const before = await client.query("debug:previewReviews", {
    placeId: "0x31356d9c4a64e8b7:0",
    limit: 3,
  });

  console.log("preview", JSON.stringify(before, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
