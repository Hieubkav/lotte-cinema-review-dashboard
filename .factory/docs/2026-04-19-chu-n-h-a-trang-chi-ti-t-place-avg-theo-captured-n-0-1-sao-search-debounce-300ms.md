# I. Primer
## 1. TL;DR kiểu Feynman
- `Điểm trung bình` sẽ không lấy từ `officialAvgRating` nữa, mà tính từ toàn bộ reviews đã capture trong Convex.
- Bộ lọc sao đổi từ `0-1,1-2,2-3,3-4,4-5` thành `1-2,2-3,3-4,4-5` (bỏ `0-1`).
- Ô search trang chi tiết sẽ debounce 300ms, luôn reset về page 1, cảm giác mượt hơn.
- Trang chi tiết sẽ đọc dữ liệu realtime từ Convex ở frontend (useQuery), không chỉ dựa dữ liệu SSR một lần.

## 2. Elaboration & Self-Explanation
Hiện trang chi tiết đang có 2 lệch chính:
1) `Điểm trung bình` dùng `place.currentAverageRating` (thường bám official), nên có thể ra 5.0 không phản ánh dữ liệu captured thực tế.
2) Search đang push URL mỗi phím gõ (không debounce), gây cảm giác giật.

Ngoài ra bộ lọc sao còn bucket `0-1` không phù hợp với yêu cầu thực tế của anh. Vì app dùng Convex, mình tận dụng `useQuery` để frontend tự cập nhật realtime khi dữ liệu review thay đổi (hard-dynamic đúng nghĩa UI data layer).

## 3. Concrete Examples & Analogies
- Trước:
  - Card “Điểm trung bình”: 5.0 (theo official)
  - Search gõ `nhân viên` -> URL đổi liên tục từng ký tự.
- Sau:
  - Card “Điểm trung bình”: tính từ toàn bộ reviews captured (ví dụ 4.2 nếu dữ liệu thực vậy)
  - Search gõ liên tục -> 300ms sau mới apply filter, reset về page 1.
- Analogy: như chuyển từ đồng hồ “ảnh chụp tĩnh” sang dashboard đang live, chỉ cập nhật khi người dùng ngừng gõ ngắn 1 nhịp.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - `src/app/[slug]/page.tsx` đang set `currentAverageRating` từ `officialAvgRating`.
  - `PlaceDetailView.tsx` input search gọi `updateFilters` trực tiếp ở `onChange` (không debounce).
  - Bucket sao hiện có `0-1` ở cả page và Convex query (`STAR_BUCKETS`).
  - Frontend chưa dùng `convex/react` (`useQuery`, `ConvexProvider`) nên chưa realtime đúng nghĩa.
- Inference:
  - UI chưa phản ánh “avg theo captured” và UX search chưa mượt.
- Decision:
  - Thêm query summary theo place từ Convex + wiring realtime frontend + debounce 300ms.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- 1) Triệu chứng: average “đẹp” nhưng không chuẩn theo captured; search khựng.
- 2) Phạm vi: trang chi tiết `[slug]`, query reviews và provider frontend.
- 3) Tái hiện: ổn định theo code hiện tại.
- 4) Mốc thay đổi gần nhất: nhiều fix crawler/navigation nhưng UI detail metrics chưa đổi theo captured-summary.
- 5) Dữ liệu thiếu: chưa có query summary chuyên cho captured average.
- 6) Giả thuyết thay thế: dùng luôn officialAvgRating để nhanh; nhưng trái yêu cầu business hiện tại.
- 7) Rủi ro nếu fix sai: số liệu card và list không đồng bộ, hoặc search bị trễ quá mức.
- 8) Pass/fail: avg hiển thị theo captured, bỏ 0-1, search debounce mượt và reset page.

**Root Cause Confidence (Độ tin cậy nguyên nhân gốc): High**
- Lý do: mismatch nằm trực tiếp ở mapping dữ liệu + UI event handling hiện tại.

```mermaid
flowchart TD
  A[URL params q/tags/stars/page] --> B[PlaceDetailView client]
  B --> C[debounce q 300ms]
  C --> D[Convex useQuery reviews:paginatedByPlace]
  B --> E[Convex useQuery reviews:summaryByPlace]
  E --> F[Card Điểm trung bình (captured)]
  D --> G[List + pagination + filters]
```

# IV. Proposal (Đề xuất)
- a) Realtime Convex trên frontend
  - Thêm `ConvexReactClient + ConvexProvider` vào `src/components/Providers.tsx` (giữ ThemeProvider như cũ).
  - `PlaceDetailView` dùng `useQuery` để lấy:
    1) `reviews:paginatedByPlace` theo params hiện tại
    2) `reviews:summaryByPlace` (mới) để lấy `capturedAvgRating`, `capturedTotalReviews`, distribution.

- b) Query summary mới cho captured average
  - Thêm `summaryByPlace` trong `convex/reviews.ts`:
    - input: `placeId`
    - output: `capturedTotalReviews`, `capturedAvgRating`, `starDistribution`.
  - Tính từ toàn bộ rows theo `placeId` (không phụ thuộc q/tags/stars).

- c) Chuẩn hóa bucket sao
  - Đổi `STAR_BUCKETS` thành `['1-2','2-3','3-4','4-5']` ở:
    - `src/app/[slug]/page.tsx`
    - `src/components/dashboard/views/PlaceDetailView.tsx`
    - `convex/reviews.ts`

- d) Search debounce 300ms
  - Trong `PlaceDetailView`:
    - thêm local state `searchInput` sync từ `searchQuery` ban đầu
    - `useEffect` debounce 300ms để gọi `updateFilters` set/remove `q`
    - vẫn reset page 1 qua `updateFilters` hiện có.

- e) Hiển thị số liệu
  - Card “Điểm trung bình”: dùng `capturedAvgRating` từ `reviews:summaryByPlace`.
  - Card “Tổng số đánh giá”: giữ số liệu thật official (`place.currentTotalReviews`) theo yêu cầu.
  - Phần list vẫn dùng `total` theo filter hiện hành.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `online-reputation-management-system/src/components/Providers.tsx`
  - Vai trò hiện tại: theme provider.
  - Thay đổi: bọc thêm ConvexProvider để enable useQuery realtime.

- **Sửa:** `online-reputation-management-system/convex/reviews.ts`
  - Vai trò hiện tại: paginated filter query + mutations reviews.
  - Thay đổi: thêm `summaryByPlace`; cập nhật `STAR_BUCKETS` bỏ 0-1.

- **Sửa:** `online-reputation-management-system/src/components/dashboard/views/PlaceDetailView.tsx`
  - Vai trò hiện tại: render UI detail + filter/search.
  - Thay đổi: dùng realtime query, debounce search 300ms, bucket sao mới, card average theo captured.

- **Sửa nhẹ:** `online-reputation-management-system/src/app/[slug]/page.tsx`
  - Vai trò hiện tại: parse params + fetch SSR dữ liệu.
  - Thay đổi: đồng bộ bucket mới; giảm phụ thuộc SSR average (UI sẽ ưu tiên realtime summary).

# VI. Execution Preview (Xem trước thực thi)
1. Thêm ConvexProvider vào Providers.
2. Tạo query `reviews:summaryByPlace`.
3. Refactor PlaceDetailView sang useQuery realtime + debounce input 300ms.
4. Đồng bộ STAR_BUCKETS mới ở cả frontend/backend query.
5. Rà static diff đảm bảo đúng scope trang detail.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Theo rule repo: không tự chạy lint/unit test.
- Verify thủ công tại route ví dụ `http://localhost:3000/the-80-s-icafe`:
  - `Điểm trung bình` != hard official nếu captured khác.
  - Không còn nút/bucket `0-1 sao`.
  - Gõ search nhanh: URL/filter chỉ cập nhật sau ~300ms.
  - Khi thêm review mới vào Convex, UI detail tự cập nhật không cần hard refresh.

# VIII. Todo
- [ ] Thêm Convex realtime provider ở frontend.
- [ ] Thêm query `reviews:summaryByPlace` cho captured average.
- [ ] Đổi STAR_BUCKETS bỏ `0-1` ở FE + Convex.
- [ ] Thêm debounce search 300ms, reset page 1.
- [ ] Commit local (không push), kèm spec file.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Card “Điểm trung bình” lấy từ captured reviews (Convex).
- Bộ lọc sao chỉ còn `1-2,2-3,3-4,4-5`.
- Search input mượt với debounce 300ms và reset trang 1.
- Trang detail dùng realtime Convex ở frontend.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro: query realtime có thể tăng số lần render nếu params đổi liên tục.
- Giảm rủi ro: debounce 300ms + reuse params stable.
- Rollback: revert theo từng file (Providers, reviews.ts, PlaceDetailView, page.tsx).

# XI. Out of Scope (Ngoài phạm vi)
- Không thay đổi crawler logic/backend scrape.
- Không redesign toàn bộ dashboard/global view.
- Không đụng schema tables ngoài query logic cần thiết.

# XII. Open Questions (Câu hỏi mở)
- Không còn ambiguity chính; yêu cầu đã chốt rõ nguồn average, bucket sao và debounce.