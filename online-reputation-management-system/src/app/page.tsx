import DashboardClient from '@/components/DashboardClient';
import { convexQuery } from '@/lib/convex';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  let cinemas: any[] = [];
  let globalMetrics = { totalReviews: 0, avgRating: 0 };
  let branchAggregates: any[] = [];

  try {
    const snapshot = await convexQuery<any>('dashboard:snapshot', {});
    const places = snapshot?.places || [];
    const latestMetrics = snapshot?.latestMetrics || [];

    cinemas = places.map((p: any) => ({
      ...p,
      placeId: p.placeId,
      place_name: p.name,
      name: p.name,
      total_reviews: p.officialTotalReviews ?? 0,
      avg_rating: p.officialAvgRating ?? 0,
      captured_total_reviews: p.capturedTotalReviews ?? 0,
      reviews: (p.reviews || []).map((r: any) => ({
        _id: r._id,
        reviewId: r.reviewId,
        cinemaId: r.placeId,
        place_id: r.placeId,
        authorName: r.authorName,
        authorThumbnail: r.authorThumbnail,
        rating: r.rating,
        text: r.text,
        isoDate: r.isoDate,
        date: r.rawDate,
        likes: r.likes,
        createdDate: r.createdAt,
        lastModified: r.updatedAt,
      })),
    }));

    const totalNetworkReviews = places.reduce(
      (acc: number, p: any) => acc + (p.officialTotalReviews || 0),
      0
    );
    const weightedSum = places.reduce(
      (acc: number, p: any) =>
        acc + (p.officialAvgRating || 0) * (p.officialTotalReviews || 0),
      0
    );

    globalMetrics = {
      totalReviews: totalNetworkReviews,
      avgRating: totalNetworkReviews > 0 ? weightedSum / totalNetworkReviews : 0,
    };

    branchAggregates = places.map((p: any) => {
      const row = latestMetrics.find((m: any) => m.placeId === p.placeId)?.metric;
      return {
        cinemaId: p.placeId,
        _count: { _all: p.officialTotalReviews ?? 0 },
        _avg: { rating: p.officialAvgRating ?? 0 },
        sentiment_score: row?.sentimentScore ?? 0,
        density_30d: row?.density30d ?? 0,
        star_distribution: row
          ? {
              '1': row.starDistribution?.star1 ?? 0,
              '2': row.starDistribution?.star2 ?? 0,
              '3': row.starDistribution?.star3 ?? 0,
              '4': row.starDistribution?.star4 ?? 0,
              '5': row.starDistribution?.star5 ?? 0,
            }
          : null,
      };
    });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }

  return (
    <main className="">
      <DashboardClient
        cinemas={cinemas}
        globalMetrics={globalMetrics}
        branchAggregates={branchAggregates}
      />
    </main>
  );
}
