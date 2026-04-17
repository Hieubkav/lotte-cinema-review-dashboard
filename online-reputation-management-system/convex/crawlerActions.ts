import { actionGeneric } from "convex/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";

function nowIso() {
  return new Date().toISOString();
}

function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildMockCrawl(placeId: string, placeName: string) {
  const base = hashSeed(`${placeId}:${placeName}`);
  const reviewCount = 15 + (base % 40);
  const officialTotalReviews = 150 + (base % 2500);
  const officialAvgRating = Number((3.6 + ((base % 15) / 20)).toFixed(1));

  const reviews = Array.from({ length: reviewCount }).map((_, idx) => {
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
    };
  });

  const stars = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
  reviews.forEach((r) => {
    if (r.rating === 1) stars.star1 += 1;
    if (r.rating === 2) stars.star2 += 1;
    if (r.rating === 3) stars.star3 += 1;
    if (r.rating === 4) stars.star4 += 1;
    if (r.rating === 5) stars.star5 += 1;
  });

  const sentimentScore =
    reviews.length > 0
      ? Number(
          (
            reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
          ).toFixed(2)
        )
      : 0;

  return {
    officialTotalReviews,
    officialAvgRating,
    reviews,
    metrics: {
      avgRating: officialAvgRating,
      totalReviews: officialTotalReviews,
      capturedReviews: reviews.length,
      sentimentScore,
      density30d: Number((reviews.length / 30).toFixed(3)),
      reviewsLast30d: reviews.length,
      starDistribution: stars,
      date: nowIso().slice(0, 10),
    },
  };
}

export const startCrawlJob = actionGeneric({
  args: {
    placeId: v.string(),
    placeName: v.string(),
    url: v.string(),
    officialOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const jobId = crypto.randomUUID();

    const createJob = makeFunctionReference<"mutation">("crawlJobs:create");
    const setStatus = makeFunctionReference<"mutation">("crawlJobs:setStatus");
    const addEvent = makeFunctionReference<"mutation">("crawlJobs:addEvent");
    const upsertPlace = makeFunctionReference<"mutation">("places:upsert");
    const upsertReviews = makeFunctionReference<"mutation">("reviews:upsertManyForPlace");
    const upsertMetrics = makeFunctionReference<"mutation">("metrics:upsertForPlace");

    await ctx.runMutation(createJob, {
      jobId,
      placeId: args.placeId,
      placeName: args.placeName,
      url: args.url,
      officialOnly: Boolean(args.officialOnly),
      message: "Job queued",
    } as any);

    try {
      await ctx.runMutation(setStatus, {
        jobId,
        status: "running",
        message: "Crawl đang chạy trên Convex action",
      } as any);

      await ctx.runMutation(addEvent, {
        jobId,
        level: "info",
        message: "Bắt đầu crawl dữ liệu",
      } as any);

      const crawl = buildMockCrawl(args.placeId, args.placeName);

      await ctx.runMutation(upsertReviews, {
        placeId: args.placeId,
        reviews: crawl.reviews,
      } as any);

      await ctx.runMutation(upsertPlace, {
        placeId: args.placeId,
        name: args.placeName,
        originalUrl: args.url,
        resolvedUrl: args.url,
        officialTotalReviews: crawl.officialTotalReviews,
        officialAvgRating: crawl.officialAvgRating,
        capturedTotalReviews: crawl.reviews.length,
        lastScrapedAt: nowIso(),
        lastSyncStatus: "completed",
        lastSyncError: undefined,
      } as any);

      await ctx.runMutation(upsertMetrics, {
        placeId: args.placeId,
        ...crawl.metrics,
      } as any);

      await ctx.runMutation(setStatus, {
        jobId,
        status: "completed",
        message: "Crawl hoàn tất",
        reviewsSynced: crawl.reviews.length,
      } as any);

      await ctx.runMutation(addEvent, {
        jobId,
        level: "info",
        message: `Đồng bộ hoàn tất ${crawl.reviews.length} reviews`,
      } as any);

      return { jobId, status: "completed" };
    } catch (error) {
      const err = error as Error;
      await ctx.runMutation(setStatus, {
        jobId,
        status: "failed",
        message: "Crawl thất bại",
        error: err.message,
      } as any);
      await ctx.runMutation(addEvent, {
        jobId,
        level: "error",
        message: err.message,
      } as any);
      return { jobId, status: "failed", error: err.message };
    }
  },
});
