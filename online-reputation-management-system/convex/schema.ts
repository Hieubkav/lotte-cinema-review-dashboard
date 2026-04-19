import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  places: defineTable({
    placeId: v.string(),
    name: v.string(),
    slug: v.string(),
    originalUrl: v.optional(v.string()),
    resolvedUrl: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    officialTotalReviews: v.number(),
    officialAvgRating: v.number(),
    capturedTotalReviews: v.number(),
    lastScrapedAt: v.optional(v.string()),
    lastSyncStatus: v.optional(v.string()),
    lastSyncError: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_placeId", ["placeId"])
    .index("by_name", ["name"])
    .index("by_slug", ["slug"]),

  reviews: defineTable({
    reviewId: v.string(),
    placeId: v.string(),
    authorName: v.optional(v.string()),
    authorThumbnail: v.optional(v.string()),
    rating: v.number(),
    text: v.string(),
    isoDate: v.optional(v.string()),
    rawDate: v.optional(v.string()),
    likes: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_placeId", ["placeId"])
    .index("by_placeId_isoDate", ["placeId", "isoDate"])
    .index("by_reviewId_placeId", ["reviewId", "placeId"]),

  branchDailyMetrics: defineTable({
    placeId: v.string(),
    date: v.string(),
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
    updatedAt: v.string(),
  })
    .index("by_placeId", ["placeId"])
    .index("by_placeId_date", ["placeId", "date"]),

  crawlJobs: defineTable({
    jobId: v.string(),
    placeId: v.string(),
    placeName: v.string(),
    url: v.string(),
    officialOnly: v.boolean(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    message: v.optional(v.string()),
    error: v.optional(v.string()),
    reviewsSynced: v.optional(v.number()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_jobId", ["jobId"])
    .index("by_status", ["status"])
    .index("by_placeId", ["placeId"]),

  crawlJobEvents: defineTable({
    jobId: v.string(),
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
    createdAt: v.string(),
  }).index("by_jobId", ["jobId"]),

  crawlCheckpoints: defineTable({
    placeId: v.string(),
    cursor: v.optional(v.string()),
    lastRunAt: v.optional(v.string()),
    lastStatus: v.optional(v.string()),
    error: v.optional(v.string()),
    updatedAt: v.string(),
  }).index("by_placeId", ["placeId"]),
});
