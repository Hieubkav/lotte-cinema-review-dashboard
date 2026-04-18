import { mutationGeneric, queryGeneric, makeFunctionReference } from "convex/server";
import { v } from "convex/values";

export const invoke = mutationGeneric({
  args: {
    placeId: v.string(),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ref = makeFunctionReference<"query">("reviews:paginatedByPlace");
    return await ctx.runQuery(ref, {
      placeId: args.placeId,
      page: args.page,
      limit: args.limit,
    } as any);
  },
});

export const cleanupMock = mutationGeneric({
  args: {
    placeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ref = makeFunctionReference<"mutation">("reviews:cleanupMockReviews");
    return await ctx.runMutation(ref, {
      placeId: args.placeId,
    } as any);
  },
});

export const previewReviews = queryGeneric({
  args: {
    placeId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(20, Math.max(1, args.limit ?? 5));
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    return rows
      .sort((a: any, b: any) => (b.isoDate || "").localeCompare(a.isoDate || ""))
      .slice(0, limit)
      .map((row: any) => ({
        reviewId: row.reviewId,
        text: row.text,
        rating: row.rating,
        isoDate: row.isoDate,
      }));
  },
});
