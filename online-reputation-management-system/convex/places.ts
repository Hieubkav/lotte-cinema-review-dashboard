import { queryGeneric, mutationGeneric, actionGeneric, makeFunctionReference } from "convex/server";
import { v } from "convex/values";

function slugifyPlaceName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "place";
}

export const list = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("places").collect();
    return rows.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  },
});

export const getBySlug = queryGeneric({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("places")
      .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
      .first();
  },
});

export const listDuplicateSlugGroups = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const places = await ctx.db.query("places").collect();
    const groups = new Map<string, any[]>();

    for (const place of places as any[]) {
      const slug = slugifyPlaceName(place.name || "");
      const bucket = groups.get(slug) || [];
      bucket.push(place);
      groups.set(slug, bucket);
    }

    return Array.from(groups.entries())
      .map(([slug, rows]) => ({
        slug,
        count: rows.length,
        rows: rows
          .slice()
          .sort((a, b) =>
            (Number(b.officialTotalReviews || 0) - Number(a.officialTotalReviews || 0)) ||
            String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
          )
          .map((row) => ({
            _id: row._id,
            placeId: row.placeId,
            name: row.name,
            slug,
            officialTotalReviews: row.officialTotalReviews ?? 0,
            capturedTotalReviews: row.capturedTotalReviews ?? 0,
            updatedAt: row.updatedAt,
          })),
      }))
      .filter((group) => group.count > 0);
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
      slug: slugifyPlaceName(args.name),
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

export const migrateDuplicateSlugGroup = mutationGeneric({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    const places = await ctx.db
      .query("places")
      .withIndex("by_name")
      .collect();

    const rows = (places as any[])
      .filter((place) => slugifyPlaceName(place.name || "") === args.slug)
      .sort((a, b) =>
        (Number(b.officialTotalReviews || 0) - Number(a.officialTotalReviews || 0)) ||
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
      );

    if (rows.length === 0) {
      return { slug: args.slug, canonicalPlaceId: null, mergedPlaceIds: [], deletedPlaceIds: [] };
    }

    const canonical = rows[0];
    const duplicates = rows.slice(1);
    const now = new Date().toISOString();

    await ctx.db.patch(canonical._id, {
      slug: args.slug,
      updatedAt: now,
    } as any);

    for (const duplicate of duplicates) {
      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_placeId", (q: any) => q.eq("placeId", duplicate.placeId))
        .collect();

      for (const review of reviews as any[]) {
        const existingReview = await ctx.db
          .query("reviews")
          .withIndex("by_reviewId_placeId", (q: any) =>
            q.eq("reviewId", review.reviewId).eq("placeId", canonical.placeId)
          )
          .first();

        if (existingReview) {
          await ctx.db.delete(review._id);
        } else {
          await ctx.db.patch(review._id, {
            placeId: canonical.placeId,
            updatedAt: now,
          } as any);
        }
      }

      const metrics = await ctx.db
        .query("branchDailyMetrics")
        .withIndex("by_placeId", (q: any) => q.eq("placeId", duplicate.placeId))
        .collect();

      for (const metric of metrics as any[]) {
        const existingMetric = await ctx.db
          .query("branchDailyMetrics")
          .withIndex("by_placeId_date", (q: any) =>
            q.eq("placeId", canonical.placeId).eq("date", metric.date)
          )
          .first();

        if (existingMetric) {
          await ctx.db.patch(existingMetric._id, {
            avgRating: metric.avgRating,
            totalReviews: metric.totalReviews,
            capturedReviews: metric.capturedReviews,
            sentimentScore: metric.sentimentScore,
            density30d: metric.density30d,
            reviewsLast30d: metric.reviewsLast30d,
            starDistribution: metric.starDistribution,
            updatedAt: now,
          } as any);
          await ctx.db.delete(metric._id);
        } else {
          await ctx.db.patch(metric._id, {
            placeId: canonical.placeId,
            updatedAt: now,
          } as any);
        }
      }

      const jobs = await ctx.db
        .query("crawlJobs")
        .withIndex("by_placeId", (q: any) => q.eq("placeId", duplicate.placeId))
        .collect();
      for (const job of jobs as any[]) {
        await ctx.db.patch(job._id, {
          placeId: canonical.placeId,
          placeName: canonical.name,
          updatedAt: now,
        } as any);
      }

      const checkpoints = await ctx.db
        .query("crawlCheckpoints")
        .withIndex("by_placeId", (q: any) => q.eq("placeId", duplicate.placeId))
        .collect();
      for (const checkpoint of checkpoints as any[]) {
        const existingCheckpoint = await ctx.db
          .query("crawlCheckpoints")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", canonical.placeId))
          .first();

        if (existingCheckpoint) {
          await ctx.db.patch(existingCheckpoint._id, {
            cursor: checkpoint.cursor ?? existingCheckpoint.cursor,
            lastRunAt: checkpoint.lastRunAt ?? existingCheckpoint.lastRunAt,
            lastStatus: checkpoint.lastStatus ?? existingCheckpoint.lastStatus,
            error: checkpoint.error ?? existingCheckpoint.error,
            updatedAt: now,
          } as any);
          await ctx.db.delete(checkpoint._id);
        } else {
          await ctx.db.patch(checkpoint._id, {
            placeId: canonical.placeId,
            updatedAt: now,
          } as any);
        }
      }

      await ctx.db.delete(duplicate._id);
    }

    return {
      slug: args.slug,
      canonicalPlaceId: canonical.placeId,
      mergedPlaceIds: rows.map((row) => row.placeId),
      deletedPlaceIds: duplicates.map((row) => row.placeId),
    };
  },
});

export const migrateToCanonicalSlugs = actionGeneric({
  args: {
    apply: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const apply = Boolean(args.apply);
    const listGroupsRef = makeFunctionReference<"query">("places:listDuplicateSlugGroups");
    const migrateGroupRef = makeFunctionReference<"mutation">("places:migrateDuplicateSlugGroup");
    const groups = await ctx.runQuery(listGroupsRef, {});
    const report = groups.map((group: any) => ({
      slug: group.slug,
      count: group.count,
      placeIds: group.rows.map((row: any) => row.placeId),
    }));
    const duplicateGroups = groups.filter((group: any) => group.count > 1);

    if (!apply) {
      return {
        apply: false,
        totalPlaces: groups.reduce((sum: number, group: any) => sum + group.count, 0),
        duplicateGroups,
        report,
      };
    }

    const applied = [];
    for (const group of duplicateGroups as any[]) {
      const result = await ctx.runMutation(migrateGroupRef, { slug: group.slug });
      applied.push(result);
    }

    return {
      apply: true,
      totalPlaces: groups.reduce((sum: number, group: any) => sum + group.count, 0),
      duplicateGroups,
      report,
      applied,
    };
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

export const removeBranch = mutationGeneric({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const place = await ctx.db
      .query("places")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .first();

    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    const metrics = await ctx.db
      .query("branchDailyMetrics")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    const checkpoints = await ctx.db
      .query("crawlCheckpoints")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    let deletedJobEvents = 0;

    for (const review of reviews) {
      await ctx.db.delete(review._id);
    }

    for (const metric of metrics) {
      await ctx.db.delete(metric._id);
    }

    for (const job of jobs) {
      const events = await ctx.db
        .query("crawlJobEvents")
        .withIndex("by_jobId", (q: any) => q.eq("jobId", job.jobId))
        .collect();

      for (const event of events) {
        await ctx.db.delete(event._id);
        deletedJobEvents += 1;
      }

      await ctx.db.delete(job._id);
    }

    for (const checkpoint of checkpoints) {
      await ctx.db.delete(checkpoint._id);
    }

    if (place) {
      await ctx.db.delete(place._id);
    }

    return {
      placeId: args.placeId,
      deletedPlace: Boolean(place),
      deletedReviews: reviews.length,
      deletedMetrics: metrics.length,
      deletedJobs: jobs.length,
      deletedJobEvents,
      deletedCheckpoints: checkpoints.length,
    };
  },
});
