import { notFound } from 'next/navigation';
import PlaceDetailView from '@/components/dashboard/views/PlaceDetailView';
import { convexQuery } from '@/lib/convex';
import { isLegacyPlaceSlug } from '@/lib/slug';
import { TAG_KEYS, type TagKey } from '@/components/dashboard/utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
const SORT_OPTIONS = new Set(['date_desc', 'date_asc']);
const STAR_BUCKETS = ['0-1', '1-2', '2-3', '3-4', '4-5'] as const;
type StarBucket = (typeof STAR_BUCKETS)[number];

function normalizeSearchQuery(value?: string) {
  const query = value?.trim() ?? '';
  return query.length > 0 ? query : undefined;
}

function normalizeTags(value?: string): TagKey[] {
  if (!value) return [];
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag): tag is TagKey => TAG_KEYS.includes(tag as TagKey));
}

function normalizeStars(value?: string): StarBucket[] {
  if (!value) return [];
  return value
    .split(',')
    .map((bucket) => bucket.trim())
    .filter((bucket): bucket is StarBucket => STAR_BUCKETS.includes(bucket as StarBucket));
}

function normalizeSort(value?: string): 'date_desc' | 'date_asc' {
  return SORT_OPTIONS.has(value ?? '') ? (value as 'date_desc' | 'date_asc') : 'date_desc';
}

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
  searchParams: Promise<{ page?: string; q?: string; tags?: string; stars?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  if (isLegacyPlaceSlug(slug)) notFound();

  const page = Math.max(1, Number(resolvedSearchParams.page || '1') || 1);
  const q = normalizeSearchQuery(resolvedSearchParams.q);
  const tags = normalizeTags(resolvedSearchParams.tags);
  const stars = normalizeStars(resolvedSearchParams.stars);
  const sort = normalizeSort(resolvedSearchParams.sort);

  try {
    const [place, reviewResult] = await Promise.all([
      convexQuery<any>('places:getBySlug', { slug }),
      convexQuery<any>('reviews:paginatedByPlace', {
        placeId: slug,
        page,
        limit: PAGE_SIZE,
        q,
        tags,
        stars,
        sort,
      }),
    ]);

    if (!place) notFound();
    const resolvedPlaceId = place.placeId;
    if (!resolvedPlaceId) notFound();
    const normalizedReviewResult =
      resolvedPlaceId === slug
        ? reviewResult
        : await convexQuery<any>('reviews:paginatedByPlace', {
            placeId: resolvedPlaceId,
            page,
            limit: PAGE_SIZE,
            q,
            tags,
            stars,
            sort,
          });

    const viewPlace = {
      ...place,
      currentAverageRating: place.officialAvgRating ?? 0,
      currentTotalReviews: place.officialTotalReviews ?? normalizedReviewResult.total ?? 0,
    };

    return (
      <PlaceDetailView
        place={viewPlace}
        reviews={(normalizedReviewResult.reviews || []).map(serializeReview)}
        page={normalizedReviewResult.page || page}
        total={normalizedReviewResult.total || 0}
        totalPages={normalizedReviewResult.totalPages || 0}
        searchQuery={q ?? ''}
        selectedTags={tags}
        selectedStars={stars}
        sort={sort}
      />
    );
  } catch {
    notFound();
  }
}
