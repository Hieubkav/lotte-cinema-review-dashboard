# I. Primer
## 1. TL;DR kiểu Feynman
- Ta sẽ chuyển route detail từ `name--placeId` sang **name-only** (vd `/lotte-cinema-ca-mau-vincom`).
- Route cũ sẽ **bỏ hẳn** như bạn yêu cầu (không redirect, không tương thích ngược).
- Dữ liệu cũ sẽ được migrate theo slug chuẩn: gom nhóm trùng, chọn bản canonical, dồn toàn bộ reviews/metrics/jobs/checkpoints về 1 `placeId` chuẩn rồi xóa bản trùng.
- Sau migrate, scraper/upsert vẫn chạy bình thường nhưng route không còn sinh theo `--placeId` nữa.

## 2. Elaboration & Self-Explanation
Hiện app đọc route bằng `extractPlaceIdFromSlug(slug)` nên bắt buộc có `--placeId`. Muốn name-only thì cần đổi nguồn định danh trang từ `placeId` sang `slug`.

Đồng thời dữ liệu cũ đang có khả năng trùng nhánh do khác `placeId` hoặc khác tên nhưng cùng thực thể. Nếu không dọn trước, route name-only sẽ dễ đụng nhau hoặc hiển thị không ổn định. Vì vậy migrate gồm 2 phần chạy theo thứ tự:
1) chuẩn hóa dữ liệu (dedupe),
2) đổi routing/query sang slug.

## 3. Concrete Examples & Analogies
- Ví dụ hiện tại: `lotte-cinema-can-tho-cai-rang--0x31a062...`.
- Sau migrate: `lotte-cinema-can-tho-cai-rang`.
- Nếu có 2 place cùng slug `lotte-cinema-a`, hệ thống chọn 1 place canonical (ưu tiên nhiều review hơn), dồn dữ liệu con về canonical, xóa place còn lại.
- Analogy: gộp 2 hồ sơ khách trùng thành 1 mã khách chuẩn trước, rồi mới đổi URL profile theo tên.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - `src/lib/slug.ts` đang build slug kiểu `name--encodeURIComponent(placeId)`.
  - `src/app/[slug]/page.tsx` parse `placeId` từ slug, thiếu `--placeId` là `notFound()`.
  - Convex `places` hiện chưa có field/index `slug`, chỉ có `placeId` và `name`.
- Inference:
  - Muốn name-only bắt buộc thêm `slug` vào source-of-truth DB và query theo slug.
- Decision:
  - Migrate DB trước, sau đó đổi routing/frontend theo slug-only, bỏ hẳn route cũ.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root Cause Confidence: **High**
1. Triệu chứng: route sinh mới/khó ổn định vì phụ thuộc `placeId` ở URL.
2. Phạm vi: web routing + Convex places + dữ liệu duplicate lịch sử.
3. Tái hiện: ổn định (mọi route detail hiện yêu cầu `--placeId`).
4. Mốc thay đổi gần nhất: CLI hiển thị route name-only nhưng app chưa support slug-only.
5. Dữ liệu thiếu: danh sách nhóm duplicate thực tế trước migrate.
6. Giả thuyết thay thế: chỉ đổi frontend mà không migrate data.
7. Rủi ro nếu fix sai nguyên nhân: route 404 hoặc map sai branch khi đụng slug.
8. Tiêu chí pass/fail: route name-only mở đúng dữ liệu; duplicate được gộp sạch.

```mermaid
flowchart TD
A[Scan places] --> B[Compute slugify(name)]
B --> C[Group by slug]
C --> D[Pick canonical placeId]
D --> E[Re-link child tables to canonical]
E --> F[Delete duplicate places]
F --> G[App query by slug only]
G --> H[Old --placeId route not supported]
```

# IV. Proposal (Đề xuất)
1. **Schema + query source-of-truth**
   - Thêm `slug` vào bảng `places`.
   - Thêm index `by_slug`.
   - Query mới: `places:getBySlug(slug)`.
2. **Data migration action (Convex)**
   - Quét toàn bộ places, tính `slugify(name)`.
   - Nhóm theo slug; mỗi nhóm >1 là duplicate-candidate.
   - Chọn canonical `placeId` (ưu tiên `officialTotalReviews` cao hơn, tie-break `updatedAt` mới hơn).
   - Re-link toàn bộ child records (`reviews`, `branchDailyMetrics`, `crawlJobs`, `crawlCheckpoints`) về canonical `placeId`.
   - Với `reviews` sau re-link, dedupe theo `reviewId + placeId` để tránh bản sao.
   - Xóa place trùng còn lại.
3. **Routing/frontend migrate**
   - `buildPlaceSlug(name, placeId)` -> trả `slugify(name)` (name-only).
   - Detail page `[slug]` query theo `slug`, bỏ logic `extractPlaceIdFromSlug`.
   - Route cũ `name--placeId` không hỗ trợ nữa (theo yêu cầu “bỏ luôn route cũ”).
4. **Scraper/upsert compatibility**
   - `places:upsert` tự tính `slug` từ `name` khi insert/update để dữ liệu mới luôn chuẩn.

# V. Files Impacted (Tệp bị ảnh hưởng)
- Sửa: `online-reputation-management-system/convex/schema.ts`
  - Vai trò hiện tại: schema places/reviews/metrics/jobs.
  - Thay đổi: thêm `slug` + index `by_slug` cho `places`.
- Sửa: `online-reputation-management-system/convex/places.ts`
  - Vai trò hiện tại: list/getByPlaceId/upsert/remove.
  - Thay đổi: thêm `getBySlug`, tính/ghi `slug`, thêm action migrate dedupe.
- Sửa: `online-reputation-management-system/src/lib/slug.ts`
  - Vai trò hiện tại: build slug kèm placeId.
  - Thay đổi: build name-only; bỏ extractor kiểu `--placeId` khỏi flow chính.
- Sửa: `online-reputation-management-system/src/app/[slug]/page.tsx`
  - Vai trò hiện tại: resolve detail bằng placeId parse từ URL.
  - Thay đổi: resolve bằng `places:getBySlug`.
- Sửa: `online-reputation-management-system/src/app/page.tsx`
  - Vai trò hiện tại: build slug cho danh sách.
  - Thay đổi: dùng slug name-only.
- Sửa: `google-review-craw/start.py`
  - Vai trò hiện tại: in route local khi chọn business.
  - Thay đổi: giữ đồng bộ route name-only (đã chỉnh).

# VI. Execution Preview (Xem trước thực thi)
1. Thêm schema/index + helper slug chuẩn dùng chung.
2. Viết Convex migration action: report dry-run -> apply.
3. Chạy migrate dữ liệu duplicate về canonical.
4. Đổi route/query frontend sang slug-only.
5. Review tĩnh toàn bộ điểm gọi `buildPlaceSlug`/`extractPlaceIdFromSlug`.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Trước migrate:
  - Dump danh sách group duplicate theo slug (evidence).
- Sau migrate:
  - Không còn group `slug` trùng trong `places`.
  - `reviews` không trùng cặp (`reviewId`,`placeId`) sau merge.
  - Mở route `/[name-only-slug]` trả đúng place + reviews.
  - Route cũ có `--placeId` không còn hoạt động (404 đúng yêu cầu).
- Type safety:
  - `bunx tsc --noEmit` (vì có đổi TS code).

# VIII. Todo
1. Thêm `slug` vào schema + index `by_slug`.
2. Tạo query/mutation/action migrate slug + dedupe.
3. Chạy migrate và lưu report before/after.
4. Đổi frontend route sang slug-only.
5. Review static và chốt commit.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- URL chuẩn chỉ còn name-only.
- Route cũ `--placeId` bị loại bỏ hoàn toàn.
- Dữ liệu duplicate do khác `placeId`/khác tên được dọn về 1 canonical record theo slug.
- Trang detail mở đúng dữ liệu từ slug-only.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro:
  - Merge nhầm nếu 2 branch khác nhau nhưng slug trùng thật sự.
- Giảm rủi ro:
  - Có chế độ dry-run + report chi tiết nhóm merge trước khi apply.
- Rollback:
  - Snapshot export trước migrate; nếu sai thì restore dữ liệu snapshot và revert commit.

# XI. Out of Scope (Ngoài phạm vi)
- Không làm redirect route cũ.
- Không tối ưu hiệu năng crawler trong spec này.

# XII. Open Questions (Câu hỏi mở)
- Không còn ambiguity lớn; có thể triển khai theo plan trên.