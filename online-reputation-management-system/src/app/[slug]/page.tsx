import { notFound } from 'next/navigation';
import PlaceDetailView from '@/components/dashboard/views/PlaceDetailView';
import { convexQuery } from '@/lib/convex';
import { extractPlaceIdFromSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

function serializeReview(r: any) {
  return {
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
  };
}

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const placeId = extractPlaceIdFromSlug(slug);

  if (!placeId) notFound();

  const page = Math.max(1, Number(resolvedSearchParams.page || '1') || 1);

  try {
    const [place, reviewResult] = await Promise.all([
      convexQuery<any>('places:getByPlaceId', { placeId }),
      convexQuery<any>('reviews:paginatedByPlace', {
        placeId,
        page,
        limit: PAGE_SIZE,
      }),
    ]);

    if (!place) notFound();

    const viewPlace = {
      ...place,
      currentAverageRating: place.officialAvgRating ?? 0,
      currentTotalReviews: place.officialTotalReviews ?? reviewResult.total ?? 0,
    };

    return (
      <PlaceDetailView
        place={viewPlace}
        reviews={(reviewResult.reviews || []).map(serializeReview)}
        page={reviewResult.page || page}
        total={reviewResult.total || 0}
        totalPages={reviewResult.totalPages || 0}
      />
    );
  } catch {
    notFound();
  }
}
