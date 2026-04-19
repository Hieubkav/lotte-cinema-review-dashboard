import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

function toDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export const byPlaceId = queryGeneric({
  args: {
    placeId: v.string(),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let rows = await ctx.db
      .query("branchDailyMetrics")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    rows = rows.filter((r: any) => {
      if (args.start && r.date < args.start) return false;
      if (args.end && r.date > args.end) return false;
      return true;
    });

    return rows.sort((a: any, b: any) => a.date.localeCompare(b.date));
  },
});

export const upsertForPlace = mutationGeneric({
  args: {
    placeId: v.string(),
    avgRating: v.number(),
    totalReviews: v.number(),
    capturedReviews: v.number(),
    sentimentScore: v.number(),
    density30d: v.number(),
    reviewsLast30d: v.number(),
    starDistribution: v.object({
      star1: v.number(),
      star2: v.number(),
      star3: v.number(),
      star4: v.number(),
      star5: v.number(),
    }),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const date = args.date ?? toDayKey();
    const existing = await ctx.db
      .query("branchDailyMetrics")
      .withIndex("by_placeId_date", (q: any) => q.eq("placeId", args.placeId).eq("date", date))
      .first();

    const payload = {
      placeId: args.placeId,
      date,
      avgRating: args.avgRating,
      totalReviews: args.totalReviews,
      capturedReviews: args.capturedReviews,
      sentimentScore: args.sentimentScore,
      density30d: args.density30d,
      reviewsLast30d: args.reviewsLast30d,
      starDistribution: args.starDistribution,
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload as any);
      return existing._id;
    }

    return await ctx.db.insert("branchDailyMetrics", payload as any);
  },
});

export const listByPlaceForMigration = queryGeneric({
  args: {
    placeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("branchDailyMetrics")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();
  },
});
