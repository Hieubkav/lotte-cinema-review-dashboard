const { ConvexHttpClient } = require("convex/browser");

async function main() {
  const client = new ConvexHttpClient("https://brainy-marten-186.convex.cloud");
  const result = await client.action("crawlerActions:startCrawlJob", {
    placeId: "0x31356d9c4a64e8b7:0",
    placeName: "LOTTE Cinema Bắc Giang",
    url: "https://www.google.com/maps/search/?api=1&query=LOTTE%20Cinema%20B%E1%BA%AFc%20Giang&query_place_id=0x31356d9c4a64e8b7:0",
    officialOnly: false,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
