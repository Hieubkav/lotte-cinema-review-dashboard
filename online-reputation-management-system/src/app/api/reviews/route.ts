import { NextResponse } from 'next/server';
import { convexQuery } from '@/lib/convex';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cinemaId = searchParams.get('cinemaId') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const result = await convexQuery<any>('reviews:paginatedByPlace', {
      placeId: cinemaId,
      page,
      limit,
    });

    const serializedReviews = (result.reviews || []).map((r: any) => ({
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
    }));

    return NextResponse.json({
      reviews: serializedReviews,
      total: result.total || 0,
      page: result.page || page,
      limit: result.limit || limit,
      totalPages: result.totalPages || 0,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
