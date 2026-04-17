export type CrawlReview = {
  reviewId: string;
  authorName?: string;
  authorThumbnail?: string;
  rating: number;
  text: string;
  isoDate?: string;
  rawDate?: string;
  likes?: number;
};

export type CrawlResult = {
  officialTotalReviews: number;
  officialAvgRating: number;
  reviews: CrawlReview[];
};
