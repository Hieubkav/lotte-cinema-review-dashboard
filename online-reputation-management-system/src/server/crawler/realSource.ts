import type { CrawlResult, CrawlReview } from "./types";

const REVIEW_WORDS = ["reviews", "review", "ratings", "rating", "đánh giá"];

function stripControlChars(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
}

function parseCount(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseRatingFromLabel(value: string): number {
  const match = value.match(/([0-5](?:[.,]\d)?)/);
  if (!match) return 0;
  return Number(match[1].replace(",", "."));
}

function parseIsoDate(raw: string): string | undefined {
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();
  return undefined;
}

function parseOfficialSummary(html: string) {
  const text = stripControlChars(html.replace(/<[^>]+>/g, " "));
  let officialTotalReviews = 0;
  let officialAvgRating = 0;

  const reviewPatterns = [
    /([\d.,]+)\s*(reviews|ratings|đánh giá)/i,
    /([\d.,]+)\s*review/i,
  ];

  for (const pattern of reviewPatterns) {
    const match = text.match(pattern);
    if (match) {
      officialTotalReviews = parseCount(match[1]);
      if (officialTotalReviews > 0) break;
    }
  }

  const ratingMatch = text.match(/\b([0-5](?:[.,]\d)?)\b/);
  if (ratingMatch) {
    officialAvgRating = Number(ratingMatch[1].replace(",", "."));
  }

  return { officialTotalReviews, officialAvgRating };
}

function extractReviewsFromHtml(html: string): CrawlReview[] {
  const cards = html.match(/<div[^>]+data-review-id="[^"]+"[\s\S]*?<\/div>\s*<\/div>?/g) ?? [];

  return cards
    .map((cardHtml): CrawlReview | null => {
      const idMatch = cardHtml.match(/data-review-id="([^"]+)"/);
      if (!idMatch) return null;

      const authorMatch =
        cardHtml.match(/<div[^>]*class="[^"]*d4r55[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ??
        cardHtml.match(/aria-label="([^"]+)"/i);

      const ratingLabelMatch = cardHtml.match(/<span[^>]+role="img"[^>]+aria-label="([^"]+)"/i);
      const dateMatch = cardHtml.match(/<span[^>]*class="[^"]*rsqaWe[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const textMatch =
        cardHtml.match(/<span[^>]+jsname="bN97Pc"[^>]*>([\s\S]*?)<\/span>/i) ??
        cardHtml.match(/<span[^>]+jsname="fbQN7e"[^>]*>([\s\S]*?)<\/span>/i) ??
        cardHtml.match(/<div[^>]*MyEned[^>]*>\s*<span[^>]*wiI7pd[^>]*>([\s\S]*?)<\/span>/i);

      const avatarMatch = cardHtml.match(/<img[^>]+src="([^"]+)"/i);
      const likesMatch =
        cardHtml.match(/toggleThumbsUp[\s\S]*?aria-label="([^"]+)"/i) ??
        cardHtml.match(/toggleThumbsUp[\s\S]*?>(\d+)</i);

      const text = stripControlChars((textMatch?.[1] ?? "").replace(/<[^>]+>/g, " "));
      const rawDate = stripControlChars((dateMatch?.[1] ?? "").replace(/<[^>]+>/g, " "));
      const rating = parseRatingFromLabel(ratingLabelMatch?.[1] ?? "");

      if (!text || rating <= 0) return null;

      return {
        reviewId: idMatch[1],
        authorName: stripControlChars((authorMatch?.[1] ?? "").replace(/<[^>]+>/g, " ")) || undefined,
        authorThumbnail: avatarMatch?.[1],
        rating,
        text,
        isoDate: parseIsoDate(rawDate),
        rawDate: rawDate || undefined,
        likes: parseCount(likesMatch?.[1] ?? ""),
      };
    })
    .filter((review): review is CrawlReview => Boolean(review));
}

function buildMapsReviewUrl(url: string): string {
  if (url.includes("/reviews")) return url;
  return `${url.replace(/\/$/, "")}/reviews`;
}

export async function fetchRealCrawl(url: string): Promise<CrawlResult> {
  const targetUrl = buildMapsReviewUrl(url);
  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9,vi;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google Maps reviews: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const summary = parseOfficialSummary(html);
  const reviews = extractReviewsFromHtml(html);

  if (reviews.length === 0) {
    const containsReviewSignals = REVIEW_WORDS.some((word) => html.toLowerCase().includes(word));
    throw new Error(
      containsReviewSignals
        ? "Không parse được review cards từ Google Maps response"
        : "Google Maps response không chứa review data có thể dùng"
    );
  }

  return {
    officialTotalReviews: summary.officialTotalReviews || reviews.length,
    officialAvgRating:
      summary.officialAvgRating ||
      Number((reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)),
    reviews,
  };
}
