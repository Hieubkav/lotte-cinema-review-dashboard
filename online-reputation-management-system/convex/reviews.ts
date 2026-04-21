import { queryGeneric, mutationGeneric } from "convex/server";
import { v } from "convex/values";

const TAG_MAP = {
  service: ['phục vụ', 'nhân viên', 'service', 'staff', 'nhiệt tình', 'thái độ', 'không hài lòng', 'support', 'hỗ trợ'],
  food: ['bắp', 'nước', 'popcorn', 'drink', 'food', 'đồ ăn', 'com bo', 'combo'],
  cleanliness: ['sạch', 'bẩn', 'vệ sinh', 'mùi', 'clean', 'dirty', 'thơm', 'hôi'],
  experience: ['phim', 'ghế', 'âm thanh', 'màn hình', 'movie', 'seat', 'sound', 'screen', 'trải nghiệm', 'ổn', 'tệ'],
  price: ['giá', 'đắt', 'rẻ', 'mắc', 'chi phí', 'tiền', 'price', 'expensive', 'cheap'],
} as const;

type TagKey = keyof typeof TAG_MAP;
const STAR_BUCKETS = ['1-2', '2-3', '3-4', '4-5'] as const;
type StarBucket = (typeof STAR_BUCKETS)[number];

function getTags(text: string = ""): TagKey[] {
  if (!text) return [];
  const lowText = text.toLowerCase();
  const tags: TagKey[] = [];

  for (const key of Object.keys(TAG_MAP) as TagKey[]) {
    if (TAG_MAP[key].some((keyword) => lowText.includes(keyword))) {
      tags.push(key);
    }
  }

  return tags;
}

function matchesStarBuckets(rating: number, selectedStars: StarBucket[]) {
  if (selectedStars.length === 0) return true;

  return selectedStars.some((bucket) => {
    const [minRaw, maxRaw] = bucket.split('-');
    const min = Number(minRaw);
    const max = Number(maxRaw);

    if (bucket === '4-5') {
      return rating >= min && rating <= max;
    }

    return rating >= min && rating < max;
  });
}

export const paginatedByPlace = queryGeneric({
  args: {
    placeId: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    q: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    stars: v.optional(v.array(v.string())),
    sort: v.optional(v.union(v.literal("date_desc"), v.literal("date_asc"))),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(200, Math.max(1, args.limit ?? 50));
    const searchQuery = args.q?.trim().toLowerCase() ?? "";
    const selectedTags = (args.tags ?? []).filter((tag): tag is TagKey => tag in TAG_MAP);
    const selectedStars = (args.stars ?? []).filter((bucket): bucket is StarBucket => STAR_BUCKETS.includes(bucket as StarBucket));
    const sort = args.sort ?? "date_desc";

    let rows = args.placeId
      ? await ctx.db
          .query("reviews")
          .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
          .collect()
      : await ctx.db.query("reviews").collect();

    rows = rows.filter((review: any) => {
      const text = (review.text ?? "").toLowerCase();
      const author = (review.authorName ?? "").toLowerCase();
      const reviewTags = getTags(review.text ?? "");
      const matchesQuery = !searchQuery || text.includes(searchQuery) || author.includes(searchQuery);
      const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => reviewTags.includes(tag));
      const matchesStars = matchesStarBuckets(Number(review.rating ?? 0), selectedStars);
      return matchesQuery && matchesTags && matchesStars;
    });

    rows = rows.sort((a: any, b: any) => {
      const result = (a.isoDate || "").localeCompare(b.isoDate || "");
      return sort === "date_asc" ? result : -result;
    });
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

export const summaryByPlace = queryGeneric({
  args: { placeId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();

    const capturedTotalReviews = rows.length;
    const totalRating = rows.reduce((sum: number, review: any) => sum + Number(review.rating ?? 0), 0);
    const capturedAvgRating = capturedTotalReviews > 0 ? Number((totalRating / capturedTotalReviews).toFixed(2)) : 0;

    const starDistribution = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
    for (const review of rows as any[]) {
      const rating = Number(review.rating ?? 0);
      if (rating === 1) starDistribution.star1 += 1;
      if (rating === 2) starDistribution.star2 += 1;
      if (rating === 3) starDistribution.star3 += 1;
      if (rating === 4) starDistribution.star4 += 1;
      if (rating === 5) starDistribution.star5 += 1;
    }

    return {
      capturedTotalReviews,
      capturedAvgRating,
      starDistribution,
    };
  },
});

export const summariesByPlaces = queryGeneric({
  args: { placeIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const summaries: Record<string, {
      capturedTotalReviews: number;
      capturedAvgRating: number;
      starDistribution: { star1: number; star2: number; star3: number; star4: number; star5: number };
    }> = {};

    for (const placeId of args.placeIds) {
      const rows = await ctx.db
        .query("reviews")
        .withIndex("by_placeId", (q: any) => q.eq("placeId", placeId))
        .collect();

      const capturedTotalReviews = rows.length;
      const totalRating = rows.reduce((sum: number, review: any) => sum + Number(review.rating ?? 0), 0);
      const capturedAvgRating = capturedTotalReviews > 0 ? Number((totalRating / capturedTotalReviews).toFixed(2)) : 0;

      const starDistribution = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
      for (const review of rows as any[]) {
        const rating = Number(review.rating ?? 0);
        if (rating === 1) starDistribution.star1 += 1;
        if (rating === 2) starDistribution.star2 += 1;
        if (rating === 3) starDistribution.star3 += 1;
        if (rating === 4) starDistribution.star4 += 1;
        if (rating === 5) starDistribution.star5 += 1;
      }

      summaries[placeId] = {
        capturedTotalReviews,
        capturedAvgRating,
        starDistribution,
      };
    }

    return summaries;
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
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const review of args.reviews) {
      const existing = await ctx.db
        .query("reviews")
        .withIndex("by_reviewId_placeId", (q: any) => q.eq("reviewId", review.reviewId).eq("placeId", args.placeId))
        .first();

      const nextLikes = review.likes ?? 0;
      const isUnchanged =
        Boolean(existing) &&
        (existing?.authorName ?? "") === (review.authorName ?? "") &&
        (existing?.authorThumbnail ?? "") === (review.authorThumbnail ?? "") &&
        Number(existing?.rating ?? 0) === Number(review.rating) &&
        (existing?.text ?? "") === review.text &&
        (existing?.isoDate ?? undefined) === (review.isoDate ?? undefined) &&
        (existing?.rawDate ?? undefined) === (review.rawDate ?? undefined) &&
        Number(existing?.likes ?? 0) === nextLikes;

      if (isUnchanged) {
        unchanged += 1;
        continue;
      }

      const payload = {
        reviewId: review.reviewId,
        placeId: args.placeId,
        authorName: review.authorName,
        authorThumbnail: review.authorThumbnail,
        rating: review.rating,
        text: review.text,
        isoDate: review.isoDate,
        rawDate: review.rawDate,
        likes: nextLikes,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload as any);
        updated += 1;
      } else {
        await ctx.db.insert("reviews", payload as any);
        inserted += 1;
      }
      upserted += 1;
    }

    return { upserted, inserted, updated, unchanged };
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

export const listByPlaceForMigration = queryGeneric({
  args: {
    placeId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_placeId", (q: any) => q.eq("placeId", args.placeId))
      .collect();
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
