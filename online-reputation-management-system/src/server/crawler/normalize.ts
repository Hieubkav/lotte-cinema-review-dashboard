import type { CrawlReview } from "./types";

export function normalizeReviewText(text: string): string {
  return text?.trim() || "No review text provided";
}

function normalizeRating(rating: number): number {
  if (!Number.isFinite(rating)) return 0;
  return Math.max(0, Math.min(5, Number(rating.toFixed(1))));
}

function normalizeIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function normalizeReviews(input: CrawlReview[]): CrawlReview[] {
  const dedup = new Map<string, CrawlReview>();

  for (const r of input) {
    if (!r.reviewId) continue;
    dedup.set(r.reviewId, {
      ...r,
      authorName: r.authorName?.trim() || undefined,
      authorThumbnail: r.authorThumbnail?.trim() || undefined,
      rating: normalizeRating(r.rating),
      text: normalizeReviewText(r.text),
      isoDate: normalizeIsoDate(r.isoDate),
      rawDate: r.rawDate?.trim() || r.isoDate?.trim() || undefined,
      likes: r.likes ?? 0,
    });
  }

  return Array.from(dedup.values());
}
