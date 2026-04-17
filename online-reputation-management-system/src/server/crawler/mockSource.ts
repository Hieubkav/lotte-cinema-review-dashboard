import type { CrawlResult, CrawlReview } from "./types";

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function generateMockCrawl(placeId: string, placeName: string): CrawlResult {
  const base = hashSeed(`${placeId}:${placeName}`);
  const count = 15 + (base % 40);
  const officialTotalReviews = 150 + (base % 2500);
  const officialAvgRating = Number((3.6 + ((base % 15) / 20)).toFixed(1));

  const reviews = Array.from({ length: count }).map((_, idx) => {
    const rating = ((base + idx) % 5) + 1;
    const ts = new Date(Date.now() - idx * 3600_000).toISOString();

    return {
      reviewId: `${placeId}-r-${base}-${idx}`,
      authorName: `User ${idx + 1}`,
      authorThumbnail: "",
      rating,
      text: `[${placeName}] Auto-captured review ${idx + 1}`,
      isoDate: ts,
      rawDate: ts,
      likes: (base + idx) % 20,
    } satisfies CrawlReview;
  });

  return {
    officialTotalReviews,
    officialAvgRating,
    reviews,
  };
}
