import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

export const list = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("places").collect();
    return rows.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  },
});

export const getByPlaceId = queryGeneric({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("places")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .first();
  },
});

export const upsert = mutationGeneric({
  args: {
    placeId: v.string(),
    name: v.string(),
    originalUrl: v.optional(v.string()),
    resolvedUrl: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    officialTotalReviews: v.optional(v.number()),
    officialAvgRating: v.optional(v.number()),
    capturedTotalReviews: v.optional(v.number()),
    lastScrapedAt: v.optional(v.string()),
    lastSyncStatus: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("places")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .first();

    const payload = {
      placeId: args.placeId,
      name: args.name,
      originalUrl: args.originalUrl,
      resolvedUrl: args.resolvedUrl,
      latitude: args.latitude,
      longitude: args.longitude,
      officialTotalReviews: args.officialTotalReviews ?? existing?.officialTotalReviews ?? 0,
      officialAvgRating: args.officialAvgRating ?? existing?.officialAvgRating ?? 0,
      capturedTotalReviews: args.capturedTotalReviews ?? existing?.capturedTotalReviews ?? 0,
      lastScrapedAt: args.lastScrapedAt ?? existing?.lastScrapedAt,
      lastSyncStatus: args.lastSyncStatus ?? existing?.lastSyncStatus,
      lastSyncError: args.lastSyncError ?? existing?.lastSyncError,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload as any);
      return existing._id;
    }

    return await ctx.db.insert("places", payload as any);
  },
});
