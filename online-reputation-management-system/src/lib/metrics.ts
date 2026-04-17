import { convexMutation, convexQuery } from '@/lib/convex';

export type SyncProgress = {
  cinema: string;
  status: 'loading' | 'success' | 'error';
  message?: string;
  jobId?: string;
};

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function runMetricsAggregation(onProgress?: (p: SyncProgress) => void) {
  const branches = await convexQuery<any[]>('places:list', {});

  if (branches.length === 0) {
    return;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const batches = chunkArray(branches, 5);

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (branch) => {
        const pid = branch.placeId;
        const name = branch.name || pid;

        if (onProgress) onProgress({ cinema: name, status: 'loading', message: 'Đang tổng hợp metrics...' });

        try {
          const reviewResult = await convexQuery<any>('reviews:paginatedByPlace', {
            placeId: pid,
            page: 1,
            limit: 500,
          });

          const reviews = reviewResult.reviews || [];
          const officialAvgRating = branch.officialAvgRating ?? 0;
          const officialTotalReviews = branch.officialTotalReviews ?? 0;

          const stars = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 };
          let ratingSum = 0;
          let recent30d = 0;

          for (const review of reviews) {
            const rating = review.rating || 0;
            ratingSum += rating;
            if (rating === 1) stars.star1 += 1;
            if (rating === 2) stars.star2 += 1;
            if (rating === 3) stars.star3 += 1;
            if (rating === 4) stars.star4 += 1;
            if (rating === 5) stars.star5 += 1;

            if (review.isoDate && new Date(review.isoDate) >= thirtyDaysAgo) {
              recent30d += 1;
            }
          }

          const capturedTotal = reviews.length;
          const sentimentScore = capturedTotal > 0 ? ratingSum / capturedTotal : 0;
          const density = recent30d / 30;

          await convexMutation('metrics:upsertForPlace', {
            placeId: pid,
            avgRating: officialAvgRating,
            totalReviews: officialTotalReviews,
            capturedReviews: branch.capturedTotalReviews ?? capturedTotal,
            sentimentScore: Number(sentimentScore.toFixed(2)),
            density30d: Number(density.toFixed(3)),
            reviewsLast30d: recent30d,
            starDistribution: stars,
            date: now.toISOString().slice(0, 10),
          });

          if (onProgress) onProgress({ cinema: name, status: 'success', message: 'Tổng hợp metrics hoàn tất' });
        } catch (err) {
          const e = err as Error;
          console.error(`Lỗi xử lý ${name}:`, e.message);
          if (onProgress) onProgress({ cinema: name, status: 'error', message: e.message });
        }
      })
    );
  }
}
