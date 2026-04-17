import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function nowIso() {
  return new Date().toISOString();
}

export const create = mutationGeneric({
  args: {
    jobId: v.string(),
    placeId: v.string(),
    placeName: v.string(),
    url: v.string(),
    officialOnly: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("crawlJobs", {
      jobId: args.jobId,
      placeId: args.placeId,
      placeName: args.placeName,
      url: args.url,
      officialOnly: args.officialOnly,
      status: "queued",
      message: args.message,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    } as any);
  },
});

export const setStatus = mutationGeneric({
  args: {
    jobId: v.string(),
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
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("crawlJobs")
      .withIndex("by_jobId", (q: any) => q.eq("jobId", args.jobId))
      .first();
    if (!job) return null;

    await ctx.db.patch(job._id, {
      status: args.status,
      message: args.message ?? job.message,
      error: args.error,
      reviewsSynced: args.reviewsSynced ?? job.reviewsSynced,
      updatedAt: nowIso(),
    } as any);

    return job._id;
  },
});

export const addEvent = mutationGeneric({
  args: {
    jobId: v.string(),
    level: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("crawlJobEvents", {
      jobId: args.jobId,
      level: args.level,
      message: args.message,
      createdAt: nowIso(),
    } as any);
  },
});

export const getByJobId = queryGeneric({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawlJobs")
      .withIndex("by_jobId", (q: any) => q.eq("jobId", args.jobId))
      .first();
  },
});

export const listByStatus = queryGeneric({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(200, Math.max(1, args.limit ?? 100));
    let rows = args.status
      ? await ctx.db.query("crawlJobs").withIndex("by_status", (q: any) => q.eq("status", args.status!)).collect()
      : await ctx.db.query("crawlJobs").collect();

    rows = rows.sort((a: any, b: any) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    return rows.slice(0, limit);
  },
});

export const eventsByJobId = queryGeneric({
  args: { jobId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("crawlJobEvents")
      .withIndex("by_jobId", (q: any) => q.eq("jobId", args.jobId))
      .collect();
    return rows.sort((a: any, b: any) => a.createdAt.localeCompare(b.createdAt));
  },
});
