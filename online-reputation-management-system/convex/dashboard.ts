import { queryGeneric } from "convex/server";

export const snapshot = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const places = await ctx.db.query("places").collect();

    const placesWithReviews = await Promise.all(
      places.map(async (place: any) => {
        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", place.placeId))
          .collect();

        const sorted = reviews.sort((a: any, b: any) => (b.isoDate || "").localeCompare(a.isoDate || ""));

        return {
          ...place,
          reviews: sorted.slice(0, 50),
        };
      })
    );

    const latestMetrics = await Promise.all(
      places.map(async (place: any) => {
        const rows = await ctx.db
          .query("branchDailyMetrics")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", place.placeId))
          .collect();
        const latest = rows.sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))[0];
        return {
          placeId: place.placeId,
          metric: latest || null,
        };
      })
    );

    return {
      places: placesWithReviews,
      latestMetrics,
    };
  },
});
