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

export const paginatedByPlace = queryGeneric({
  args: {
    placeId: v.optional(v.string()),
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
    q: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    sort: v.optional(v.union(v.literal("date_desc"), v.literal("date_asc"))),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(200, Math.max(1, args.limit ?? 50));
    const searchQuery = args.q?.trim().toLowerCase() ?? "";
    const selectedTags = (args.tags ?? []).filter((tag): tag is TagKey => tag in TAG_MAP);
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
      return matchesQuery && matchesTags;
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
