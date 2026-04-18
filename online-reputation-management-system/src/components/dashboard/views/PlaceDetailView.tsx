'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Star, Tags, FilterX, CalendarDays, Search, Activity, RefreshCcw, ExternalLink,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import ReviewCard from '../components/ReviewCard';
import { TAG_KEYS, TAG_LABELS, type TagKey } from '../utils';

const STAR_BUCKETS = ['0-1', '1-2', '2-3', '3-4', '4-5'] as const;
type StarBucket = (typeof STAR_BUCKETS)[number];

type Review = {
  _id?: string;
  reviewId?: string;
  place_id?: string;
  cinemaId?: string;
  authorName?: string | null;
  authorThumbnail?: string | null;
  rating: number;
  text?: string | null;
  isoDate?: string | null;
  date?: string | null;
  likes?: number;
  createdDate?: string | null;
  lastModified?: string | null;
};

type PlaceDetailViewProps = {
  place: any;
  reviews: Review[];
  page: number;
  total: number;
  totalPages: number;
  searchQuery: string;
  selectedTags: TagKey[];
  selectedStars: StarBucket[];
  sort: 'date_desc' | 'date_asc';
};

function buildPageHref(page: number, params: URLSearchParams) {
  const next = new URLSearchParams(params.toString());
  if (page <= 1) next.delete('page');
  else next.set('page', String(page));
  const query = next.toString();
  return query ? `?${query}` : '.';
}

export default function PlaceDetailView({
  place,
  reviews,
  page,
  total,
  totalPages,
  searchQuery,
  selectedTags,
  selectedStars,
  sort,
}: PlaceDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);

  const pageNumbers = React.useMemo(() => {
    if (totalPages <= 1) return [];
    const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    return Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  }, [page, totalPages]);

  const startSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const resp = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cinemas: [{ id: place.placeId, url: place.originalUrl, name: place.name }],
          officialOnly: true,
        }),
      });
      if (!resp.ok) throw new Error('Không thể đồng bộ dữ liệu');
      router.refresh();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Đồng bộ thất bại');
    } finally {
      setIsSyncing(false);
    }
  };

  const currentParams = new URLSearchParams(searchParams.toString());

  const updateFilters = React.useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      updater(next);
      next.delete('page');
      const query = next.toString();
      router.push(query ? `?${query}` : '?');
    },
    [router, searchParams]
  );

  return (
    <div className="min-h-screen bg-background text-primary">
      <div className="sticky top-0 z-30 apple-nav px-6 lg:px-10 flex items-center h-[48px]">
        <header className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h2
                className="text-sm font-semibold text-white leading-none truncate max-w-[180px] sm:max-w-xs md:max-w-md"
                style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif', letterSpacing: '-0.12px' }}
              >
                {place.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-white/50 font-medium uppercase tracking-widest">Trang chi tiết rạp</span>
              </div>
            </div>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.placeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-2 text-[#2997ff] hover:bg-white/10 rounded-apple transition-colors"
              title="Xem trên Google Maps"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative hidden md:block w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                placeholder="Tìm trong đánh giá..."
                value={searchQuery}
                onChange={(e) =>
                  updateFilters((params) => {
                    const value = e.target.value.trim();
                    if (value) params.set('q', value);
                    else params.delete('q');
                  })
                }
                className="w-full h-8 bg-white/10 border-none focus:bg-white/[0.15] rounded-[11px] pl-9 pr-8 text-[13px] text-white placeholder:text-white/30 outline-none transition-all"
                style={{ letterSpacing: '-0.12px' }}
              />
            </div>

            <button
              onClick={startSync}
              disabled={isSyncing}
              className="flex items-center gap-2 h-7 px-4 bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#006edb] disabled:opacity-50 text-white text-[12px] font-semibold rounded-[980px] transition-colors"
              style={{ letterSpacing: '-0.12px' }}
            >
              <RefreshCcw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Đang đồng bộ' : 'Đồng bộ'}</span>
            </button>
          </div>
        </header>
      </div>

      <main className="p-6 lg:p-10 flex flex-col gap-8 bg-[var(--bg-main)]">
        <div className="flex items-center gap-2 text-sm text-tertiary">
          <Link href="/" className="hover:text-primary transition-colors">Tổng quan</Link>
          <span>/</span>
          <span className="text-primary">{place.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="apple-card p-6 flex flex-col gap-4">
                <div className="w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0 bg-amber-500/10">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-tertiary uppercase" style={{ letterSpacing: '0.05em' }}>Điểm trung bình</p>
                  <p className="text-3xl font-bold text-primary mt-1.5 leading-[1.07] tabular-nums" style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif', letterSpacing: '-0.28px' }}>
                    {Number(place.currentAverageRating || 0).toFixed(1)}
                  </p>
                  <p className="text-[13px] text-tertiary mt-1.5 leading-[1.47]" style={{ letterSpacing: '-0.374px' }}>
                    Theo số liệu Google hiện tại
                  </p>
                </div>
              </div>

              <div className="apple-card p-6 flex flex-col gap-4">
                <div className="w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0 bg-[#af52de]/10">
                  <Activity className="w-5 h-5 text-[#af52de]" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-tertiary uppercase" style={{ letterSpacing: '0.05em' }}>Tổng số đánh giá</p>
                  <p className="text-3xl font-bold text-primary mt-1.5 leading-[1.07] tabular-nums" style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif', letterSpacing: '-0.28px' }}>
                    {total.toLocaleString('vi-VN')}
                  </p>
                  <p className="text-[13px] text-tertiary mt-1.5 leading-[1.47]" style={{ letterSpacing: '-0.374px' }}>
                    Hiển thị 24 đánh giá mỗi trang
                  </p>
                </div>
              </div>
            </div>

            <div className="apple-card p-6 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-[21px] font-bold text-primary flex items-center gap-2 leading-[1.19]" style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif', letterSpacing: '0.231px' }}>
                    <Tags className="w-5 h-5 text-[#0071e3]" />
                    Danh sách đánh giá
                  </h4>
                  <p className="text-[13px] text-tertiary mt-1.5 leading-[1.47]" style={{ letterSpacing: '-0.374px' }}>
                    Tổng {total.toLocaleString('vi-VN')} đánh giá, trang {page}/{Math.max(totalPages, 1)}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex bg-[var(--surface-3)] p-0.5 rounded-[980px] flex-wrap gap-0.5">
                    {STAR_BUCKETS.map((bucket) => (
                      <button
                        key={bucket}
                        onClick={() =>
                          updateFilters((params) => {
                            const nextStars = selectedStars.includes(bucket)
                              ? selectedStars.filter((item) => item !== bucket)
                              : [...selectedStars, bucket];
                            if (nextStars.length > 0) params.set('stars', nextStars.join(','));
                            else params.delete('stars');
                          })
                        }
                        className={`px-3 py-1 rounded-[980px] text-[12px] font-semibold transition-all ${selectedStars.includes(bucket) ? 'bg-amber-500 text-white shadow-sm' : 'text-tertiary hover:text-secondary'}`}
                        style={{ letterSpacing: '-0.12px' }}
                      >
                        {bucket} sao
                      </button>
                    ))}
                    {selectedStars.length > 0 && (
                      <button
                        onClick={() =>
                          updateFilters((params) => {
                            params.delete('stars');
                          })
                        }
                        className="p-1 px-2 text-tertiary hover:text-[#ff453a] transition-colors"
                        title="Bỏ lọc sao"
                      >
                        <FilterX className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex bg-[var(--surface-3)] p-0.5 rounded-[980px] flex-wrap gap-0.5">
                    {TAG_KEYS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          updateFilters((params) => {
                            const nextTags = selectedTags.includes(tag)
                              ? selectedTags.filter((item) => item !== tag)
                              : [...selectedTags, tag];
                            if (nextTags.length > 0) params.set('tags', nextTags.join(','));
                            else params.delete('tags');
                          })
                        }
                        className={`px-3 py-1 rounded-[980px] text-[12px] font-semibold transition-all ${selectedTags.includes(tag) ? 'bg-[#0071e3] text-white shadow-sm' : 'text-tertiary hover:text-secondary'}`}
                        style={{ letterSpacing: '-0.12px' }}
                      >
                        {TAG_LABELS[tag]}
                      </button>
                    ))}
                    {selectedTags.length > 0 && (
                      <button
                        onClick={() =>
                          updateFilters((params) => {
                            params.delete('tags');
                          })
                        }
                        className="p-1 px-2 text-tertiary hover:text-[#ff453a] transition-colors"
                        title="Bỏ lọc"
                      >
                        <FilterX className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      updateFilters((params) => {
                        params.set('sort', sort === 'date_desc' ? 'date_asc' : 'date_desc');
                      })
                    }
                    className="p-2 bg-[var(--surface-3)] hover:bg-[var(--surface-2)] rounded-[8px] text-tertiary hover:text-secondary transition-colors"
                    title="Đổi thứ tự ngày"
                  >
                    <CalendarDays className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {syncError && (
                <p className="text-sm text-[#ff453a]">{syncError}</p>
              )}

              {reviews.length === 0 ? (
                <div className="py-12 text-center text-tertiary">Không tìm thấy đánh giá phù hợp.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reviews.map((review, idx) => (
                    <ReviewCard key={review._id || review.reviewId || idx} review={review} highlightedReviewId={null} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
                  <div className="text-sm text-tertiary">
                    Đang xem trang <span className="text-primary font-semibold">{page}</span> trên <span className="text-primary font-semibold">{totalPages}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {page <= 1 ? (
                      <span
                        aria-disabled
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[980px] text-sm font-semibold transition-colors pointer-events-none bg-[var(--surface-3)] text-tertiary/50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Trang trước
                      </span>
                    ) : (
                      <Link
                        href={buildPageHref(page - 1, currentParams)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[980px] text-sm font-semibold transition-colors bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-primary"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Trang trước
                      </Link>
                    )}

                    {pageNumbers.map((pageNumber, index) => {
                      const prev = pageNumbers[index - 1];
                      const showDots = prev && pageNumber - prev > 1;
                      return (
                        <React.Fragment key={pageNumber}>
                          {showDots && <span className="px-1 text-tertiary">...</span>}
                          <Link
                            href={buildPageHref(pageNumber, currentParams)}
                            className={`min-w-10 h-10 inline-flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${pageNumber === page ? 'bg-[#0071e3] text-white' : 'bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-primary'}`}
                          >
                            {pageNumber}
                          </Link>
                        </React.Fragment>
                      );
                    })}

                    {page >= totalPages ? (
                      <span
                        aria-disabled
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[980px] text-sm font-semibold transition-colors pointer-events-none bg-[var(--surface-3)] text-tertiary/50"
                      >
                        Trang sau
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    ) : (
                      <Link
                        href={buildPageHref(page + 1, currentParams)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-[980px] text-sm font-semibold transition-colors bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-primary"
                      >
                        Trang sau
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="apple-card sticky top-20 p-6 flex flex-col gap-4">
              <h4 className="text-[17px] font-bold text-primary leading-[1.29]" style={{ fontFamily: '"SF Pro Display", -apple-system, sans-serif', letterSpacing: '-0.224px' }}>
                Thông tin rạp
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-tertiary">Tên rạp</p>
                  <p className="text-primary font-semibold">{place.name}</p>
                </div>
                <div>
                  <p className="text-tertiary">Place ID</p>
                  <p className="text-primary font-mono break-all">{place.placeId}</p>
                </div>
                <div>
                  <p className="text-tertiary">Google chính thức</p>
                  <p className="text-primary font-semibold">{Number(place.currentTotalReviews || total).toLocaleString('vi-VN')} đánh giá</p>
                </div>
                <div>
                  <p className="text-tertiary">Lần cập nhật gần nhất</p>
                  <p className="text-primary font-semibold">{place.lastScraped ? new Date(place.lastScraped).toLocaleString('vi-VN') : 'Chưa có dữ liệu'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
