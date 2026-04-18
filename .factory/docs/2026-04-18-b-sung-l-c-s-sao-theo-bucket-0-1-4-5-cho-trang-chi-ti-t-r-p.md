# I. Primer
## 1. TL;DR kiểu Feynman
- Trang `/<slug>?sort=...` đã có lọc tag (dịch vụ/đồ ăn/...) nhưng chưa có lọc theo khoảng sao.
- Em sẽ thêm filter sao theo bucket: `0-1`, `1-2`, `2-3`, `3-4`, `4-5`, hoạt động giống filter tag: bật/tắt độc lập, lọc trên toàn bộ dữ liệu theo query backend.
- Khi đổi filter sao sẽ tự xóa `page` để quay về trang 1 (giữ đúng UX hiện tại của tag filter).
- Không đổi schema, chỉ mở rộng query/filter hiện có và UI chips ở trang chi tiết.

## 2. Elaboration & Self-Explanation
Hiện flow đang lọc theo `tags` tại Convex query `reviews:paginatedByPlace`, rồi mới sort + phân trang. Yêu cầu mới là thêm một điều kiện lọc nữa theo `rating` theo từng khoảng (bucket), ví dụ chọn `4-5` thì chỉ lấy review có `rating` trong khoảng đó.

Để đồng bộ với cách filter tag hiện tại, em giữ cùng pattern:
1) Parse query param ở route server (`[slug]/page.tsx`) →
2) truyền vào Convex query →
3) Convex lọc tập dữ liệu trước khi paginate →
4) UI hiển thị chip đang chọn và toggle bằng URL param.

Vì `updateFilters` hiện đã có `next.delete('page')`, nên khi user bấm bucket sao sẽ tự về page 1 đúng yêu cầu, không cần phát minh cơ chế mới.

## 3. Concrete Examples & Analogies
- Ví dụ URL: `...?sort=date_desc&stars=4-5,3-4`
  - Kết quả: chỉ lấy review có `rating >= 3 && rating < 5` (riêng bucket `4-5` sẽ bao gồm `5`).
  - Sau khi user bật thêm `1-2`, URL đổi và `page` bị xóa -> luôn về trang 1.

- Analogy: tag filter là “lọc theo chủ đề”, star filter là “lọc theo mức điểm”. Hai cái là hai lớp lưới chồng lên nhau; review phải lọt cả hai lớp mới hiển thị.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: `src/app/[slug]/page.tsx` đang normalize `q`, `tags`, `sort`, chưa có `stars`.
- Observation: `src/components/dashboard/views/PlaceDetailView.tsx` có cụm chips cho tag + `updateFilters` đã reset `page`.
- Observation: `convex/reviews.ts` (`paginatedByPlace`) đang filter theo `q` + `tags`, chưa filter theo rating range.
- Inference: Thiếu cả 3 mắt xích (parse param, truyền query arg, filter backend + UI chips).
- Decision: Mở rộng đúng flow hiện hữu, không tạo endpoint mới.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Nguyên nhân gốc: logic lọc hiện tại chưa có dimension “rating bucket”, chỉ có text/tag/sort.
- Giả thuyết đối chứng đã loại trừ:
  - “Do UI chưa render chip” -> chưa đủ, vì backend cũng chưa nhận tham số sao.
  - “Do pagination” -> không phải nguyên nhân chính; pagination đã reset page khi đổi filter.

**Root Cause Confidence (Độ tin cậy nguyên nhân gốc): High** — có bằng chứng trực tiếp từ code ở cả route/UI/Convex.

```mermaid
flowchart TD
  A[User click chip sao] --> B[updateFilters set stars]
  B --> C[URL query updated + delete page]
  C --> D[[slug]/page.tsx parse stars]
  D --> E[convex reviews:paginatedByPlace]
  E --> F[Filter q + tags + stars]
  F --> G[Sort + paginate]
  G --> H[Render list page 1]
```

# IV. Proposal (Đề xuất)
1. Thêm hằng số bucket sao dùng chung ở UI route chi tiết:
   - `STAR_BUCKETS = ['0-1','1-2','2-3','3-4','4-5']`.
2. Mở rộng parse search params trong `src/app/[slug]/page.tsx`:
   - thêm `normalizeStars(value?: string): StarBucket[]`.
   - truyền `stars` vào `convexQuery('reviews:paginatedByPlace', ...)`.
3. Mở rộng Convex query `convex/reviews.ts`:
   - thêm args optional `stars: v.optional(v.array(v.string()))` (lọc theo whitelist bucket hợp lệ).
   - thêm hàm `matchesStarBuckets(rating, selectedStars)`.
   - filter condition cuối cùng: `matchesQuery && matchesTags && matchesStars`.
4. Mở rộng `PlaceDetailView`:
   - nhận thêm prop `selectedStars`.
   - render nhóm chip sao tương tự tag chip.
   - toggle chip -> set/delete query `stars`, luôn reset page qua `updateFilters` hiện có.
5. Giữ nguyên behavior khác (sort, search, tag, pagination, sync).

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `online-reputation-management-system/src/app/[slug]/page.tsx`
  - Vai trò hiện tại: parse query và gọi Convex cho page detail.
  - Thay đổi: thêm parse/validate `stars`, truyền vào query và props view.

- **Sửa:** `online-reputation-management-system/src/components/dashboard/views/PlaceDetailView.tsx`
  - Vai trò hiện tại: UI filter tag + sort + pagination.
  - Thay đổi: thêm UI chip lọc sao và toggle query `stars` theo pattern tag.

- **Sửa:** `online-reputation-management-system/convex/reviews.ts`
  - Vai trò hiện tại: filter q/tags rồi sort + paginate.
  - Thay đổi: thêm filter rating bucket trước khi phân trang.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc lại style/pattern filter hiện tại ở `PlaceDetailView`.
2. Bổ sung type + normalize `stars` ở `[slug]/page.tsx`.
3. Nối wiring prop `selectedStars` xuống view.
4. Thêm logic filter sao trong Convex query.
5. Thêm cụm UI chips sao + toggle URL params.
6. Self-review tĩnh: type-safety, null-safety, bucket boundary 0/5.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Static review (không chạy lint/test theo quy ước repo):
  1) Kiểm tra type `StarBucket` đồng nhất route/UI/convex.
  2) Kiểm tra boundary rating:
     - `0-1`: `>=0 && <1`
     - `1-2`: `>=1 && <2`
     - ...
     - `4-5`: `>=4 && <=5`
  3) Kiểm tra khi đổi `stars` thì `page` bị xóa khỏi URL.
- Repro manual cho tester:
  1) Mở URL có `page=3`, bật chip `4-5` -> xác nhận về page 1.
  2) Kết hợp `tags=food` + `stars=4-5` -> dữ liệu giảm đúng giao.
  3) Tắt toàn bộ chip sao -> trả về hành vi cũ.

# VIII. Todo
1. Thêm model bucket sao và parse query `stars`.
2. Nối `stars` từ route vào Convex query.
3. Bổ sung filter rating buckets trong `reviews:paginatedByPlace`.
4. Thêm UI chip sao ở PlaceDetailView (toggle + active state).
5. Đảm bảo đổi filter sao luôn reset về page 1.
6. Self-review tĩnh toàn bộ luồng.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Có nhóm lọc sao với 5 bucket: `0-1`, `1-2`, `2-3`, `3-4`, `4-5`.
- Bấm chip sao sẽ lọc dữ liệu toàn bộ qua backend (không lọc cục bộ client).
- Có thể kết hợp đồng thời với tag filter hiện tại.
- Mỗi lần đổi star filter, URL mất `page` và hiển thị trang 1.
- Pagination/sort/search vẫn hoạt động như trước.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro chính: sai boundary bucket (đặc biệt rating=5) gây thiếu/thừa dữ liệu.
- Giảm thiểu: viết hàm match bucket rõ ràng và review case biên.
- Rollback: bỏ tham số `stars` ở route/UI và revert điều kiện `matchesStars` trong Convex.

# XI. Out of Scope (Ngoài phạm vi)
- Không thêm sort theo sao.
- Không thay đổi schema Convex.
- Không thay đổi endpoint khác ngoài luồng page detail hiện tại.

# XII. Open Questions (Câu hỏi mở)
- Không còn ambiguity quan trọng; có thể triển khai ngay theo yêu cầu hiện tại.