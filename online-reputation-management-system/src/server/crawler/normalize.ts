import type { CrawlReview } from "./mockSource";

export function normalizeReviewText(text: string): string {
  return text?.trim() || "No review text provided";
}

export function normalizeReviews(input: CrawlReview[]): CrawlReview[] {
  const dedup = new Map<string, CrawlReview>();

  for (const r of input) {
    if (!r.reviewId) continue;
    dedup.set(r.reviewId, {
      ...r,
      text: normalizeReviewText(r.text),
      likes: r.likes ?? 0,
    });
  }

  return Array.from(dedup.values());
}
