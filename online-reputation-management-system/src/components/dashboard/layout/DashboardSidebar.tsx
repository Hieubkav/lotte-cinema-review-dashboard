import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Globe, Search, X, Building2, DownloadCloud, Activity, ArrowUpDown, Trash2, Layers3 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { convexAction, convexMutation } from '@/lib/convex';
import { getTags } from '../utils';
import { DashboardState } from '../hooks/useDashboardData';

const EXCEL_HEADER_FILL = 'FF0F172A';
const EXCEL_HEADER_FONT = 'FFFFFFFF';
const EXCEL_BORDER = 'FF334155';
const EXCEL_RATING_HIGH_FILL = 'FFDCFCE7';
const EXCEL_RATING_HIGH_FONT = 'FF166534';
const EXCEL_RATING_MID_FILL = 'FFFEF3C7';
const EXCEL_RATING_MID_FONT = 'FF92400E';
const EXCEL_RATING_LOW_FILL = 'FFFEE2E2';
const EXCEL_RATING_LOW_FONT = 'FFB91C1C';
const EXCEL_SHEET_NAME_MAX_LENGTH = 31;

function sanitizeSheetName(name?: string) {
  const sanitized = (name || 'Unknown')
    .replace(/[:\\\/\?\*\[\]]/g, '')
    .trim();

  return (sanitized || 'Unknown').substring(0, EXCEL_SHEET_NAME_MAX_LENGTH);
}

function buildUniqueSheetName(baseName: string, usedSheetNames: Set<string>) {
  const normalizedBaseName = sanitizeSheetName(baseName);

  if (!usedSheetNames.has(normalizedBaseName)) {
    usedSheetNames.add(normalizedBaseName);
    return normalizedBaseName;
  }

  let suffix = 2;

  while (suffix < 1000) {
    const suffixText = `_${suffix}`;
    const truncatedBaseName = normalizedBaseName.substring(
      0,
      EXCEL_SHEET_NAME_MAX_LENGTH - suffixText.length
    ) || 'Unknown';
    const candidate = `${truncatedBaseName}${suffixText}`;

    if (!usedSheetNames.has(candidate)) {
      usedSheetNames.add(candidate);
      return candidate;
    }

    suffix += 1;
  }

  const fallbackName = `Sheet_${Date.now()}`.substring(0, EXCEL_SHEET_NAME_MAX_LENGTH);
  usedSheetNames.add(fallbackName);
  return fallbackName;
}

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: EXCEL_HEADER_FONT } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_HEADER_FILL },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: EXCEL_BORDER } },
      left: { style: 'thin', color: { argb: EXCEL_BORDER } },
      bottom: { style: 'thin', color: { argb: EXCEL_BORDER } },
      right: { style: 'thin', color: { argb: EXCEL_BORDER } },
    };
  });
}

function applyRatingStyle(cell: ExcelJS.Cell, rating: number) {
  if (rating >= 4) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_RATING_HIGH_FILL },
    };
    cell.font = { color: { argb: EXCEL_RATING_HIGH_FONT }, bold: true };
    return;
  }

  if (rating < 3) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_RATING_LOW_FILL },
    };
    cell.font = { color: { argb: EXCEL_RATING_LOW_FONT }, bold: true };
    return;
  }

  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_RATING_MID_FILL },
  };
  cell.font = { color: { argb: EXCEL_RATING_MID_FONT }, bold: true };
}

function formatSidebarDate(value?: string | null, withTime: boolean = false) {
  if (!value) return '--';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleString('vi-VN', withTime
    ? {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    : {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

export default function DashboardSidebar({ state }: { state: DashboardState }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    viewMode, setViewMode,
    cinemaSearchQuery, setCinemaSearchQuery,
    sidebarSort, setSidebarSort,
    filteredCinemas,
    cinemasWithLatest,
    sidebarSnapshotDate,
    isMobileSidebarOpen, setIsMobileSidebarOpen
  } = state;
  const [deletingPlaceId, setDeletingPlaceId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeduping, setIsDeduping] = React.useState(false);
  const [dedupeError, setDedupeError] = React.useState<string | null>(null);

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const usedSheetNames = new Set<string>();
    const overviewSheet = workbook.addWorksheet('OVERVIEW');

    usedSheetNames.add('OVERVIEW');

    overviewSheet.columns = [
      { header: 'Cinema Name', key: 'cinemaName', width: 36 },
      { header: 'New Google Reviews', key: 'reviewCount', width: 20 },
      { header: 'Average Rating', key: 'averageRating', width: 18 },
    ];

    applyHeaderStyle(overviewSheet.getRow(1));
    overviewSheet.views = [{ state: 'frozen', ySplit: 1 }];

    cinemasWithLatest.forEach((cinema) => {
      const overviewRow = overviewSheet.addRow({
        cinemaName: cinema.place_name || 'Unknown',
        reviewCount: Number(cinema.currentTotalReviews || 0),
        averageRating: Number(cinema.currentAverageRating || 0),
      });
      const ratingCell = overviewRow.getCell(3);
      ratingCell.numFmt = '0.00';
      applyRatingStyle(ratingCell, Number(cinema.currentAverageRating || 0));
    });

    cinemasWithLatest.forEach((cinema) => {
      const worksheet = workbook.addWorksheet(
        buildUniqueSheetName(cinema.place_name || 'Unknown', usedSheetNames)
      );

      worksheet.columns = [
        { header: 'Date', key: 'date', width: 18 },
        { header: 'Author', key: 'author', width: 24 },
        { header: 'Rating', key: 'rating', width: 12 },
        { header: 'Review', key: 'review', width: 60 },
        { header: 'Translated', key: 'translated', width: 60 },
        { header: 'Tags', key: 'tags', width: 28 },
        { header: 'Local Guide', key: 'localGuide', width: 14 },
        { header: 'Likes', key: 'likes', width: 12 },
      ];

      applyHeaderStyle(worksheet.getRow(1));
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const cinemaReviews = [...cinema.reviews]
        .map((review: any) => ({
          date: review.date || '',
          author: review.authorName || '',
          rating: Number(review.rating || 0),
          review: review.text || '',
          translated: review.translated || '',
          tags: getTags(review.text || '').join(', '),
          localGuide: review.localGuide ? 'Yes' : 'No',
          likes: Number(review.likes || 0),
        }))
        .sort((a, b) => b.rating - a.rating);

      cinemaReviews.forEach((review) => {
        const reviewRow = worksheet.addRow(review);
        const ratingCell = reviewRow.getCell(3);
        applyRatingStyle(ratingCell, review.rating);
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob(
      [buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer)],
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ORMS_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
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

  const handleBulkDedupe = async () => {
    if (isDeduping || deletingPlaceId) return;

    setIsDeduping(true);
    setDedupeError(null);

    try {
      const preview = await convexAction<{
        duplicateGroups: Array<{ slug: string; count: number; rows?: Array<{ name?: string; placeId?: string }> }>;
        report: Array<{ slug: string; count: number; placeIds: string[] }>;
      }>('places:migrateToCanonicalSlugs', { apply: false });

      const duplicateGroups = preview?.duplicateGroups || [];

      if (duplicateGroups.length === 0) {
        window.alert('Không có chi nhánh trùng theo company để dọn.');
        return;
      }

      const summaryLines = duplicateGroups.slice(0, 8).map((group) => {
        const sampleName = group.rows?.[0]?.name || group.slug;
        return `- ${sampleName}: ${group.count} bản ghi`;
      });

      const hiddenCount = duplicateGroups.length - summaryLines.length;
      const confirmed = window.confirm(
        [
          `Phát hiện ${duplicateGroups.length} nhóm company trùng.`,
          '',
          ...summaryLines,
          hiddenCount > 0 ? `- Và ${hiddenCount} nhóm khác` : '',
          '',
          'Hệ thống sẽ giữ bản mới nhất và xóa bản cũ.',
          'Tiếp tục dọn trùng?'
        ].filter(Boolean).join('\n')
      );

      if (!confirmed) return;

      await convexAction('places:migrateToCanonicalSlugs', { apply: true });

      if (pathname !== '/') {
        router.push('/');
      }
      router.refresh();
    } catch (error) {
      setDedupeError(error instanceof Error ? error.message : 'Dọn trùng thất bại');
    } finally {
      setIsDeduping(false);
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
          w-80 h-screen fixed lg:sticky top-0 left-0 z-50
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

          {dedupeError && (
            <p className="px-3 pb-3 text-[12px] text-[#ff6b61]">
              {dedupeError}
            </p>
          )}

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
            <div className="flex flex-col gap-0.5">
              {filteredCinemas.map((c) => {
                const isActive = pathname === `/${c.slug}`;
                const shortName = (c.place_name || '').replace(/LOTTE Cinema\s*/gi, '').trim() || c.name || 'Unknown';
                const isDeleting = deletingPlaceId === c.place_id;
                const crawlDate = c.lastScrapedAt || c.lastScraped || null;
                const hasData = Number(c.currentTotalReviews || 0) > 0 || Number(c.capturedReviews || 0) > 0 || Boolean(crawlDate);
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
                      className="min-w-0 flex flex-1 items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <Building2 className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-[#0071e3]' : 'text-tertiary group-hover:text-secondary'}`} />
                        <div className="min-w-0 flex-1">
                          <span
                            className="block text-[13px] font-medium leading-[1.25] whitespace-normal break-words"
                            style={{ letterSpacing: '-0.12px' }}
                          >
                            {shortName}
                          </span>
                          <div className="mt-1 space-y-0.5">
                            <p className="text-[9px] text-tertiary/80 leading-tight">
                              Crawl {formatSidebarDate(crawlDate, true)}
                            </p>
                            <p className="text-[9px] text-tertiary/75 leading-tight">
                              Đợt {formatSidebarDate(sidebarSnapshotDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 ml-1 pt-0.5">
                        {c.currentAverageRating > 0 && (
                          <span className={`text-[11px] font-bold tabular-nums leading-tight ${isActive ? 'text-[#0071e3]' : 'text-amber-500'}`}>
                            {c.currentAverageRating.toFixed(1)}
                          </span>
                        )}
                        <span className="text-[10px] text-tertiary tabular-nums leading-tight">
                          {Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')}
                        </span>
                        <span className="text-[9px] text-tertiary/75 tabular-nums leading-tight">
                          DB {Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} / G {Number(c.officialTotalReviews || c.total_reviews || 0).toLocaleString('vi-VN')}
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
                          : `Xóa ${shortName} (${Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} DB / ${Number(c.officialTotalReviews || c.total_reviews || 0).toLocaleString('vi-VN')} Google)`
                      }
                      aria-label={
                        isDeleting
                          ? `Đang xóa ${shortName}`
                          : `Xóa ${shortName}, hiện có ${Number(c.currentTotalReviews || 0).toLocaleString('vi-VN')} đánh giá DB capture và ${Number(c.officialTotalReviews || c.total_reviews || 0).toLocaleString('vi-VN')} đánh giá Google`
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
        <div className="px-3 py-4 border-t border-[var(--border-color)] space-y-2">
          <button
            onClick={handleBulkDedupe}
            disabled={isDeduping || Boolean(deletingPlaceId)}
            className="w-full flex items-center justify-center gap-2 h-9 px-4 bg-[#0071e3]/10 hover:bg-[#0071e3]/15 border border-[#0071e3]/20 rounded-apple text-[13px] font-medium text-[#0071e3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ letterSpacing: '-0.12px' }}
          >
            <Layers3 className={`w-4 h-4 ${isDeduping ? 'animate-pulse' : ''}`} />
            {isDeduping ? 'Đang dọn trùng' : 'Dọn trùng company'}
          </button>
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
