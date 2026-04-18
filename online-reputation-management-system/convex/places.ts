import { queryGeneric, mutationGeneric, actionGeneric, makeFunctionReference } from "convex/server";
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

export const seedFromLegacyOfficialApi = actionGeneric({
  args: {
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const url = args.sourceUrl || 'https://online-reputation-management-system.vercel.app/api/places/official';
    const response = await fetch(url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Failed to fetch legacy places: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      data?: Array<{
        placeId: string;
        name: string;
        avgRating?: number;
        totalReviews?: number;
        capturedReviews?: number;
        lastScraped?: string;
      }>;
    };

    const rows = data.data || [];
    const upsertRef = makeFunctionReference<'mutation'>('places:upsert');

    let imported = 0;
    for (const row of rows) {
      if (!row.placeId || !row.name) continue;

      await ctx.runMutation(upsertRef, {
        placeId: row.placeId,
        name: row.name,
        originalUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.name)}&query_place_id=${row.placeId}`,
        resolvedUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.name)}&query_place_id=${row.placeId}`,
        officialTotalReviews: row.totalReviews ?? 0,
        officialAvgRating: row.avgRating ?? 0,
        capturedTotalReviews: row.capturedReviews ?? 0,
        lastScrapedAt: row.lastScraped,
        lastSyncStatus: 'seeded_from_legacy_api',
        lastSyncError: undefined,
      } as any);

      imported += 1;
    }

    return {
      sourceUrl: url,
      totalFetched: rows.length,
      imported,
    };
  },
});
