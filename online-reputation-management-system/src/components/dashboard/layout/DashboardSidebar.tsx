import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, Search, X, LayoutDashboard, TrendingUp, Building2, DownloadCloud, Activity, ArrowUpDown, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { convexMutation } from '@/lib/convex';
import { getTags } from '../utils';
import { DashboardState } from '../hooks/useDashboardData';

export default function DashboardSidebar({ state }: { state: DashboardState }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    viewMode, setViewMode,
    cinemaSearchQuery, setCinemaSearchQuery,
    sidebarSort, setSidebarSort,
    filteredCinemas,
    cinemasWithLatest,
    isMobileSidebarOpen, setIsMobileSidebarOpen
  } = state;
  const [deletingPlaceId, setDeletingPlaceId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const overviewData = cinemasWithLatest.map(c => ({
      "Cinema Name": c.place_name,
      "New Google Reviews": c.currentTotalReviews,
      "Average Rating": c.currentAverageRating.toFixed(2),
    }));
    const wsOverview = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, "OVERVIEW");

    cinemasWithLatest.forEach(c => {
      const cinemaReviews = c.reviews.map((r: any) => ({
        "Date": r.date,
        "Author": r.authorName,
        "Rating": r.rating,
        "Review": r.text,
        "Translated": r.translated || "",
        "Tags": getTags(r.text).join(", "),
        "Local Guide": r.localGuide ? "Yes" : "No",
        "Likes": r.likes || 0
      }));
      cinemaReviews.sort((a: any, b: any) => b.Rating - a.Rating);
      const wsCinema = XLSX.utils.json_to_sheet(cinemaReviews);
      const safeName = (c.place_name || 'Unknown').replace(/[\[\]\*\?\/\\]/g, "").substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsCinema, safeName);
    });

    XLSX.writeFile(wb, `ORMS_Audit_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const cycleSidebarSort = () => {
    setSidebarSort((s: string) => s === 'name' ? 'rating-desc' : s === 'rating-desc' ? 'rating-asc' : 'name');
  };

  const sortLabel = sidebarSort === 'name' ? 'A–Z' : sidebarSort === 'rating-desc' ? '★ Cao' : '★ Thấp';

  const handleDeleteBranch = async (
    event: React.MouseEvent<HTMLButtonElement>,
    cinema: DashboardState['filteredCinemas'][number]
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (deletingPlaceId) return;

    const branchName = cinema.place_name || cinema.name || 'Chi nhánh không tên';
    const googleReviews = Number(cinema.currentTotalReviews || 0).toLocaleString('vi-VN');
    const capturedReviews = Number(cinema.capturedReviews || 0).toLocaleString('vi-VN');
    const confirmed = window.confirm(
      [
        `Xóa chi nhánh "${branchName}" khỏi hệ thống?`,
        '',
        `Google official: ${googleReviews} đánh giá`,
        `Đã capture trong DB: ${capturedReviews} đánh giá`,
        `Place ID: ${cinema.place_id}`,
        '',
        'Thao tác này sẽ xóa chi nhánh và toàn bộ dữ liệu liên quan, không thể hoàn tác tự động.',
      ].join('\n')
    );

    if (!confirmed) return;

    setDeletingPlaceId(cinema.place_id);
    setDeleteError(null);

    try {
      await convexMutation('places:removeBranch', { placeId: cinema.place_id });
      if (pathname === `/${cinema.slug}`) {
        router.push('/');
      }
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Xóa chi nhánh thất bại');
    } finally {
      setDeletingPlaceId(null);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`
          w-72 h-screen fixed lg:sticky top-0 left-0 z-50
          flex flex-col
          sidebar-glass
          transition-transform duration-300 lg:translate-x-0
          ${isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
        `}
        style={{ borderRight: 'none' }}
      >
        {/* Brand */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#0071e3] flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <p
                  className="text-[15px] font-bold text-primary leading-none"
                  style={{ letterSpacing: '0.231px', fontFamily: '"SF Pro Display", -apple-system, sans-serif' }}
                >
                  ORMS
                </p>
                <p className="text-[11px] text-tertiary mt-1 uppercase font-bold tracking-wider leading-none">
                  Theo dõi đánh giá
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-2 text-secondary hover:text-primary rounded-[8px] hover:bg-[var(--surface-2)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nav items */}
        <nav className="px-3 flex flex-col gap-1">
          <Link
            href="/"
            onClick={() => { setViewMode('global'); setIsMobileSidebarOpen(false); }}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-[8px] text-[14px] font-medium transition-all text-left
              ${pathname === '/'
                ? 'bg-[#0071e3]/10 text-[#0071e3]'
                : 'text-secondary hover:text-primary hover:bg-[var(--surface-2)]'
              }
            `}
            style={{ letterSpacing: '-0.224px' }}
          >
            <Globe className={`w-4 h-4 flex-shrink-0 ${pathname === '/' ? 'text-[#0071e3]' : ''}`} />
            Tổng quan
          </Link>
        </nav>

        {/* Cinema list */}
        <div className="flex-1 flex flex-col min-h-0 px-3 py-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-2 px-3">
            <p
              className="text-[11px] font-bold text-tertiary uppercase tracking-wider"
              style={{ letterSpacing: '0.05em' }}
            >
              Chi nhánh
            </p>
            <button
              onClick={cycleSidebarSort}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-tertiary hover:text-secondary rounded-[6px] transition-colors"
              title="Đổi cách sắp xếp"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortLabel}</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4 px-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tertiary" />
            <input
              type="text"
              placeholder="Tìm chi nhánh..."
              value={cinemaSearchQuery}
              onChange={e => setCinemaSearchQuery(e.target.value)}
              className="w-full h-8 bg-[var(--surface-3)] border-none focus:bg-[var(--surface-2)] rounded-[11px] pl-9 pr-8 text-[13px] text-primary placeholder:text-tertiary outline-none transition-all"
              style={{ letterSpacing: '-0.12px' }}
            />
            {cinemaSearchQuery && (
              <button
                onClick={() => setCinemaSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary hover:text-secondary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {deleteError && (
            <p className="px-3 pb-3 text-[12px] text-[#ff6b61]">
              {deleteError}
            </p>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
            <div className="flex flex-col gap-0.5">
              {filteredCinemas.map((c) => {
                const isActive = pathname === `/${c.slug}`;
                const shortName = (c.place_name || '').replace(/LOTTE Cinema\s*/gi, '').trim() || c.name || 'Unknown';
                const isDeleting = deletingPlaceId === c.place_id;
                const hasData = Number(c.currentTotalReviews || 0) > 0 || Number(c.capturedReviews || 0) > 0 || Boolean(c.lastScraped);
                return (
                  <div
                    key={c.place_id}
                    className={`
                      group w-full flex items-center justify-between px-3 py-2 rounded-[8px] text-left transition-all
                      ${isActive
                        ? 'bg-[#0071e3]/10 text-[#0071e3]'
                        : 'text-secondary hover:text-primary hover:bg-[var(--surface-2)]'
                      }
                    `}
                  >
                    <Link
                      href={`/${c.slug}`}
                      onClick={() => { setViewMode('branch'); setIsMobileSidebarOpen(false); }}
                      className="min-w-0 flex flex-1 items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                        <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#0071e3]' : 'text-tertiary group-hover:text-secondary'}`} />
                        <span
                          className="text-[13px] font-medium truncate"
                          style={{ letterSpacing: '-0.12px' }}
                        >
                          {shortName}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-2">
                        {c.currentAverageRating > 0 && (
                          <span className={`text-[11px] font-bold tabular-nums leading-tight ${isActive ? 'text-[#0071e3]' : 'text-amber-500'}`}>
                            {c.currentAverageRating.toFixed(1)}
                          </span>
                        )}
                        <span className="text-[10px] text-tertiary tabular-nums leading-tight">
                          {Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[9px] text-tertiary/75 tabular-nums leading-tight">
                          G {Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} / DB {Number(c.capturedReviews || 0).toLocaleString('vi-VN')}
                        </span>
                        {!hasData && (
                          <span className="text-[10px] text-tertiary/80 leading-tight">
                            Chưa cào
                          </span>
                        )}
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={(event) => void handleDeleteBranch(event, c)}
                      disabled={Boolean(deletingPlaceId)}
                      className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#ff6b61] opacity-100 transition-all hover:bg-[#ff453a]/10 hover:text-[#ff8a80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff453a]/40 disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        isDeleting
                          ? `Đang xóa ${shortName}...`
                          : `Xóa ${shortName} (${Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} Google / ${Number(c.capturedReviews || 0).toLocaleString('vi-VN')} DB)`
                      }
                      aria-label={
                        isDeleting
                          ? `Đang xóa ${shortName}`
                          : `Xóa ${shortName}, hiện có ${Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} đánh giá Google và ${Number(c.capturedReviews || 0).toLocaleString('vi-VN')} đánh giá đã capture`
                      }
                    >
                      <Trash2 className={`h-3.5 w-3.5 ${isDeleting ? 'animate-pulse' : ''}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-[var(--border-color)]">
          <button
            onClick={exportToExcel}
            className="w-full flex items-center justify-center gap-2 h-9 px-4 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border-color)] rounded-apple text-[13px] font-medium text-secondary hover:text-primary transition-colors"
            style={{ letterSpacing: '-0.12px' }}
          >
            <DownloadCloud className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>
      </aside>
    </>
  );
}
