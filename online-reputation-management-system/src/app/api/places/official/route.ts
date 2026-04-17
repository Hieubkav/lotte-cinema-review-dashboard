import { NextResponse } from 'next/server';
import { convexQuery } from '@/lib/convex';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get('placeId');

  try {
    if (placeId) {
      const place = await convexQuery<any>('places:getByPlaceId', { placeId });
      if (!place) {
        return NextResponse.json({ error: 'Place not found in database' }, { status: 404 });
      }

      return NextResponse.json({
        placeId: place.placeId,
        name: place.name,
        avgRating: place.officialAvgRating ?? 0,
        totalReviews: place.officialTotalReviews ?? 0,
        capturedReviews: place.capturedTotalReviews ?? 0,
        source: 'convex',
        lastScraped: place.lastScrapedAt,
        lastSyncStatus: place.lastSyncStatus ?? null,
        lastSyncError: place.lastSyncError ?? null,
      });
    }

    const places = await convexQuery<any[]>('places:list', {});
    const results = places.map((place: any) => ({
      placeId: place.placeId,
      name: place.name,
      avgRating: place.officialAvgRating ?? 0,
      totalReviews: place.officialTotalReviews ?? 0,
      capturedReviews: place.capturedTotalReviews ?? 0,
      source: 'convex',
      lastScraped: place.lastScrapedAt,
      lastSyncStatus: place.lastSyncStatus ?? null,
      lastSyncError: place.lastSyncError ?? null,
    }));

    return NextResponse.json({ data: results });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
