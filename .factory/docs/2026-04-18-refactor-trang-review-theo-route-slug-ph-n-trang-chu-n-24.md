# I. Primer
## 1. TL;DR kiểu Feynman
- Hiện tại trang đang trộn 2 nguồn review: `snapshot` (50 review đầu) + API phân trang (page 2, limit 100), nên bị hổng dải review 51–100.
- Em sẽ chuyển sang phân trang chuẩn 24 review/trang, luôn lấy theo `page` thống nhất, không trộn kiểu cũ.
- Mỗi place sẽ có route riêng dạng `/<slug-ten-place>` thay vì dồn tất cả trong một màn.
- Grid review sẽ là `1 cột mobile`, `3 cột từ md+` như anh yêu cầu.
- UI sẽ Việt hóa các nhãn chính và hiển thị tổng số review rõ ràng.

## 2. Elaboration & Self-Explanation
Vấn đề chính không phải thiếu dữ liệu DB, mà là cách ghép dữ liệu ở frontend làm mất một đoạn review ở giữa. Cụ thể: initial load lấy 50 item mới nhất từ `dashboard:snapshot`, nhưng khi bấm tải thêm lại nhảy sang API với `page=2&limit=100`; điều này bỏ qua item 51–100. Vì vậy người dùng có cảm giác “không lấy hết review”.

Cách xử lý đúng là chỉ dùng **một contract phân trang duy nhất**: page nào thì backend trả đúng page đó với cùng `limit` (24). Frontend render theo page hiện tại, có Prev/Next + số trang, và luôn hiển thị `total` để user biết tổng số review hiện có.

## 3. Concrete Examples & Analogies
Ví dụ thực tế:
- Place A có 260 review trong DB.
- Trang chi tiết `/<slug-place-a>` mở mặc định page 1, limit 24 → hiển thị review 1–24 (mới nhất theo `isoDate`).
- Bấm trang 2 → hiển thị 25–48.
- Pagination hiển thị: `Trang 2 / 11`, `Tổng: 260 đánh giá`.

Analogy đời thường:
- Cách cũ giống như lấy 50 hồ sơ đầu từ tủ A, rồi khi “lấy tiếp” lại nhảy sang tủ B và bắt đầu từ hồ sơ 101 → mất luôn hồ sơ 51–100.
- Cách mới là luôn mở cùng một tủ và lật từng ngăn 24 hồ sơ theo thứ tự.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: `convex/dashboard.ts` trả `reviews: sorted.slice(0, 50)` cho mỗi place.
- Observation: `useDashboardData.ts` đang merge `c.reviews` + `extraReviews`, và load thêm bằng `/api/reviews?page=nextPage&limit=100`.
- Observation: `nextPage` mặc định từ 1 -> gọi page 2 ngay lần đầu load thêm.
- Observation: `BranchView.tsx` đang render grid `md:grid-cols-2` và dùng nút `Load more`.
- Inference: mismatch giữa “initial 50” và “API page 2 limit 100” tạo lỗ dữ liệu.
- Decision: bỏ chiến lược merge mixed-source, chuyển sang page-based single source cho chi tiết place.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
1. Triệu chứng: user thấy review không đầy đủ; expected là xem hết theo phân trang, actual là có cảm giác thiếu đoạn.
2. Phạm vi ảnh hưởng: màn branch/place detail (Review Feed), không ảnh hưởng dữ liệu lưu DB.
3. Tái hiện: ổn định khi place có >50 review và bấm load thêm.
4. Mốc thay đổi gần nhất: snapshot giới hạn 50 + luồng loadMore tách riêng trong `useDashboardData.ts`.
5. Thiếu dữ liệu để chắc 100%: chưa có log request/response production cho từng place; có thể bổ sung network trace khi verify UI.
6. Giả thuyết thay thế: crawler chưa crawl đủ hoặc Convex query thiếu index; chưa bị loại trừ hoàn toàn nhưng không giải thích được pattern “thiếu đoạn giữa”.
7. Rủi ro nếu fix sai nguyên nhân: chỉ đổi UI text/layout mà không đổi contract page sẽ vẫn mất dữ liệu khi duyệt trang.
8. Pass/fail sau sửa: duyệt liên tục từ page 1→N không bị hổng dải, tổng số hiển thị khớp API `total`, route `/<slug>` hoạt động đúng.

**Root Cause Confidence:** High — bằng chứng trực tiếp từ code path `slice(0,50)` + `page=2&limit=100`.

# IV. Proposal (Đề xuất)
## 1. Kiến trúc route
- Thêm route động `src/app/[slug]/page.tsx` cho từng place.
- Mỗi page place fetch dữ liệu place theo slug + render view chi tiết riêng.
- Sidebar/entry points đổi từ `setViewMode('branch')` sang `router.push('/<slug>')`.

## 2. Contract phân trang chuẩn
- Chuẩn hóa `limit = 24` cho place detail.
- API reviews vẫn dùng `reviews:paginatedByPlace`, nhưng frontend chỉ dùng page-based state (không merge loadMore).
- UI pagination: Prev / số trang / Next.

## 3. UI/UX theo yêu cầu
- Grid review: `grid-cols-1 md:grid-cols-3`.
- Hiển thị tổng số: `Tổng {total} đánh giá` gần tiêu đề Review Feed.
- Việt hóa text chính: Sync, Load more, Overview, Branches, Best first, Worst first, results, average…

## 4. Chia module tránh “viết chùm chùm”
- Tách logic place detail ra hook/component riêng (không nhồi vào `useDashboardData` toàn cục).
- Root dashboard giữ vai trò overview + điều hướng sang `/<slug>`.

```mermaid
flowchart TD
  A[/[slug] page/] --> B[Resolve slug -> placeId]
  B --> C[Fetch page reviews limit=24]
  C --> D[Render grid md:3 cột]
  D --> E[Prev/Next + số trang]
  E --> C
```

# V. Files Impacted (Tệp bị ảnh hưởng)
## UI
- **Thêm:** `src/app/[slug]/page.tsx`  
  Vai trò hiện tại: chưa có route chi tiết theo slug.  
  Thay đổi: render trang chi tiết place theo slug, gọi data theo page.

- **Sửa:** `src/components/dashboard/layout/DashboardSidebar.tsx`  
  Vai trò hiện tại: set state nội bộ để đổi branch trong cùng trang.  
  Thay đổi: điều hướng sang route `/<slug>` cho từng place.

- **Sửa:** `src/components/dashboard/views/BranchView.tsx` (hoặc tách mới cho PlaceView)  
  Vai trò hiện tại: render review + load more trong view branch.  
  Thay đổi: grid 3 cột md+, phân trang Prev/Next + page numbers, hiển thị tổng số, Việt hóa text.

- **Sửa:** `src/components/dashboard/hooks/useDashboardData.ts`  
  Vai trò hiện tại: quản lý cả global + branch + load more ghép dữ liệu.  
  Thay đổi: bỏ/giảm logic merge `extraReviews`, tách pagination state cho place-route flow.

- **Sửa:** `src/components/dashboard/layout/DashboardHeader.tsx`  
  Vai trò hiện tại: title/CTA theo mode global/branch.  
  Thay đổi: Việt hóa label và đồng bộ ngữ cảnh route mới.

## Server/API
- **Sửa:** `src/app/api/reviews/route.ts`  
  Vai trò hiện tại: trả reviews phân trang theo placeId/page/limit.  
  Thay đổi: chuẩn hóa default limit 24 và bảo toàn shape `{reviews,total,page,totalPages}` cho UI route mới.

## Shared
- **Thêm:** `src/lib/slug.ts` (hoặc util tương đương)  
  Vai trò hiện tại: chưa có helper slug chuẩn.  
  Thay đổi: slugify tên place, resolve slug -> place.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc/chốt contract route + pagination từ flow hiện tại.
2. Thêm util slug + route `src/app/[slug]/page.tsx`.
3. Refactor điều hướng sidebar sang route slug.
4. Refactor review list sang paging 24/item, bỏ “load more” kiểu cũ.
5. Cập nhật grid 3 cột md+ + tổng số + Việt hóa nhãn.
6. Static self-review: typing, null-safety, compatibility dữ liệu cũ.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Static checks (không chạy runtime test theo rule repo):
  1) Soát type/nullable ở các điểm `placeId`, `slug`, `totalPages`.
  2) Soát fallback khi slug không tồn tại (not found).
  3) Soát contract API response giữa route + UI.
- Repro checklist cho tester:
  1) Mở `/<slug>` của place có >100 review.
  2) Đi lần lượt page 1→2→3, xác nhận không hổng dải review.
  3) Đối chiếu `Tổng số` với API `total`.
  4) Kiểm tra md+ hiển thị đúng 3 cột; mobile vẫn 1 cột.

# VIII. Todo
1. Thêm route động `/<slug>` cho từng place.
2. Tạo helper slugify + resolve slug/place.
3. Chuyển điều hướng từ state branch sang route.
4. Chuẩn hóa pagination 24/review (Prev/Next + page number).
5. Đổi grid review thành `md:grid-cols-3`.
6. Hiển thị tổng số review rõ ràng.
7. Việt hóa các chuỗi UI liên quan.
8. Tự review tĩnh trước bàn giao.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Truy cập được route `/<slug-ten-place>` cho từng place.
- Mỗi trang hiển thị đúng 24 review.
- Có điều hướng Prev/Next + số trang, hoạt động đúng.
- Tổng số review hiển thị rõ và khớp API `total`.
- Grid review là 3 cột từ `md+`, mobile không vỡ layout.
- Không còn hiện tượng thiếu dải review khi duyệt nhiều trang.
- UI text chính được Việt hóa tự nhiên.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro slug trùng tên place: có thể map nhầm place.
- Giảm thiểu: ưu tiên slugify nhất quán; nếu trùng sẽ fallback theo rule deterministic (ghi nhận để nâng cấp suffix khi cần).
- Rollback: giữ route cũ ở `/` và fallback điều hướng nội bộ branch view nếu route mới gặp lỗi.

# XI. Out of Scope (Ngoài phạm vi)
- Không thay đổi crawler/sync pipeline.
- Không thay đổi schema Convex.
- Không thêm tính năng filter/sort mới ngoài yêu cầu phân trang + route + Việt hóa + layout.