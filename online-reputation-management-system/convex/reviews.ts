import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

export const paginatedByPlace = queryGeneric({
  args: {
    placeId: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(200, Math.max(1, args.limit ?? 50));

    let rows = args.placeId
      ? await ctx.db
          .query("reviews")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
          .collect()
      : await ctx.db.query("reviews").collect();

    rows = rows.sort((a: any, b: any) => (b.isoDate || "").localeCompare(a.isoDate || ""));
    const total = rows.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      reviews: rows.slice(start, end),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
});

export const countByPlace = queryGeneric({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();
    return rows.length;
  },
});

export const upsertManyForPlace = mutationGeneric({
  args: {
    placeId: v.string(),
    reviews: v.array(
      v.object({
        reviewId: v.string(),
        authorName: v.optional(v.string()),
        authorThumbnail: v.optional(v.string()),
        rating: v.number(),
        text: v.string(),
        isoDate: v.optional(v.string()),
        rawDate: v.optional(v.string()),
        likes: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    let upserted = 0;

    for (const review of args.reviews) {
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_reviewId_placeId", (q: any) => q.eq("reviewId", review.reviewId).eq("placeId", args.placeId))
        .first();

      const payload = {
        reviewId: review.reviewId,
        placeId: args.placeId,
        authorName: review.authorName,
        authorThumbnail: review.authorThumbnail,
        rating: review.rating,
        text: review.text,
        isoDate: review.isoDate,
        rawDate: review.rawDate,
        likes: review.likes ?? 0,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload as any);
      } else {
        await ctx.db.insert("reviews", payload as any);
      }
      upserted += 1;
    }

    return { upserted };
  },
});

export const cleanupByPlace = mutationGeneric({
  args: {
    placeId: v.string(),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    for (const review of reviews) {
      await ctx.db.delete(review._id);
    }

    const metrics = await ctx.db
      .query("branchDailyMetrics")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    for (const metric of metrics) {
      await ctx.db.delete(metric._id);
    }

    return {
      placeId: args.placeId,
      deletedReviews: reviews.length,
      deletedMetrics: metrics.length,
    };
  },
});

export const cleanupMockReviews = mutationGeneric({
  args: {
    placeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reviews = args.placeId
      ? await ctx.db
          .query("reviews")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId!))
          .collect()
      : await ctx.db.query("reviews").collect();

    let deletedReviews = 0;
    const placeIds = new Set<string>();

    for (const review of reviews) {
      if (!review.text?.includes("Auto-captured review")) continue;
      await ctx.db.delete(review._id);
      deletedReviews += 1;
      placeIds.add(review.placeId);
    }

    const metrics = args.placeId
      ? await ctx.db
          .query("branchDailyMetrics")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId!))
          .collect()
      : await ctx.db.query("branchDailyMetrics").collect();

    let deletedMetrics = 0;
    for (const metric of metrics) {
      if (!placeIds.has(metric.placeId) && (!args.placeId || metric.placeId !== args.placeId)) continue;
      await ctx.db.delete(metric._id);
      deletedMetrics += 1;
    }

    return {
      deletedReviews,
      deletedMetrics,
      affectedPlaceIds: Array.from(placeIds),
    };
  },
});
