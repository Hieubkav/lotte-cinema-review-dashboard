# I. Primer
## 1. TL;DR kiểu Feynman
- Anh cần **2 nút riêng** tại trang `/:slug`: 
  - Nút A: chỉ xóa dữ liệu đánh giá/metrics của chi nhánh, **giữ chi nhánh**.
  - Nút B: xóa chi nhánh khỏi hệ thống, **xóa luôn toàn bộ dữ liệu liên quan**.
- Backend hiện đã có sẵn một phần: `reviews:cleanupByPlace` (xóa reviews + branchDailyMetrics).
- Thiếu mutation để xóa `place` record + dữ liệu liên quan trọn gói.
- Em sẽ thêm 2 mutation rõ ràng, rồi nối vào UI trang chi tiết với confirm 1 bước (Yes/No).
- Sau khi thao tác thành công, UI sẽ refresh; riêng xóa chi nhánh sẽ chuyển về `/` để tránh trang slug không còn dữ liệu.

## 2. Elaboration & Self-Explanation
- Hiện tại dữ liệu chi nhánh tách làm 3 nhóm chính: `places` (thông tin chi nhánh), `reviews` (đánh giá), `branchDailyMetrics` (số liệu ngày).
- Yêu cầu của anh chia thành 2 hành vi khác nhau:
  a) **Xóa dữ liệu**: dọn `reviews` + `branchDailyMetrics` theo `placeId`, nhưng record `places` vẫn tồn tại để chi nhánh vẫn hiện trong sidebar.
  b) **Xóa chi nhánh**: phải xóa luôn `places` và toàn bộ dữ liệu liên quan, để chi nhánh biến mất khỏi UI và URL slug đó không truy cập được nữa.
- Để tránh mơ hồ, em sẽ làm 2 API mutation tách biệt theo đúng intent, không gom chung vào 1 mutation nhiều mode.
- Trên UI `PlaceDetailView`, em thêm khu vực “thao tác nguy hiểm” gồm 2 nút độc lập, mỗi nút confirm browser 1 bước trước khi gọi API.
- Sau gọi API: 
  - Xóa dữ liệu -> `router.refresh()` ngay trang hiện tại.
  - Xóa chi nhánh -> `router.push('/')` rồi refresh để sidebar cập nhật.

## 3. Concrete Examples & Analogies
- Ví dụ cụ thể với `http://localhost:3000/test-place--p1`:
  a) Bấm **Xóa dữ liệu chi nhánh** → `reviews` + `branchDailyMetrics` của `placeId=p1` về 0; trang `/test-place--p1` vẫn mở được, chi nhánh vẫn có trong danh sách.
  b) Bấm **Xóa chi nhánh** → xóa `places(placeId=p1)` + toàn bộ reviews/metrics của p1; truy cập lại `/test-place--p1` sẽ notFound, sidebar không còn chi nhánh đó.
- Analogy đời thường: 
  - Xóa dữ liệu = “dọn sạch hồ sơ hoạt động của cửa hàng nhưng giữ biển hiệu cửa hàng”.
  - Xóa chi nhánh = “đóng cửa hẳn cửa hàng và hủy luôn toàn bộ hồ sơ của cửa hàng đó”.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - `convex/reviews.ts` đã có `cleanupByPlace(placeId)` xóa `reviews` + `branchDailyMetrics`.
  - `convex/places.ts` chưa có mutation xóa chi nhánh.
  - `src/app/[slug]/page.tsx` lấy dữ liệu qua `places:getByPlaceId` + `reviews:paginatedByPlace`.
  - `src/components/dashboard/views/PlaceDetailView.tsx` là nơi phù hợp để đặt 2 nút riêng theo yêu cầu.
- Inference:
  - Tính năng 1 gần như đã có backend, chủ yếu cần wiring UI.
  - Tính năng 2 cần backend mới + wiring UI + redirect.
- Decision:
  - Giữ kiến trúc Convex hiện tại, thêm mutation tối thiểu ở `places.ts`, không đổi schema.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root Cause (High confidence):
  - Thiếu surface thao tác xóa trên UI.
  - Thiếu mutation “xóa chi nhánh + dữ liệu liên quan” ở backend.
- Counter-hypothesis đã loại trừ:
  - “Có thể dùng API hiện tại để xóa chi nhánh” → không có function nào xóa `places` record.
  - “Xóa dữ liệu đang không làm được” → thực tế đã có `reviews:cleanupByPlace`, chỉ chưa expose ở UI.

# IV. Proposal (Đề xuất)
- A) Backend
  1. Giữ `reviews:cleanupByPlace` cho tính năng “xóa dữ liệu”.
  2. Thêm mutation mới trong `convex/places.ts`, ví dụ `removeBranch`:
     - Input: `placeId`.
     - Query `places` theo `placeId`, nếu không có thì trả kết quả idempotent.
     - Query + delete toàn bộ `reviews` theo `placeId`.
     - Query + delete toàn bộ `branchDailyMetrics` theo `placeId`.
     - Delete record `places`.
     - Trả summary `{ deletedPlace, deletedReviews, deletedMetrics }`.

- B) Frontend
  1. `PlaceDetailView.tsx`: thêm 2 action handler:
     - `handleDeleteBranchData` gọi `convexMutation('reviews:cleanupByPlace', { placeId })`.
     - `handleDeleteBranch` gọi `convexMutation('places:removeBranch', { placeId })`.
  2. Add 2 nút riêng ở section “Thao tác dữ liệu” (danger zone), text rõ ràng:
     - “Xóa dữ liệu chi nhánh”
     - “Xóa chi nhánh”
  3. Cả 2 dùng confirm 1 bước (`window.confirm`) đúng yêu cầu.
  4. UX sau thao tác:
     - Sau xóa dữ liệu: refresh hiện tại.
     - Sau xóa chi nhánh: điều hướng `/` + refresh.
  5. Thêm state loading/error nhẹ để tránh double click và báo lỗi ngắn.

```mermaid
flowchart TD
  A[User ở /:slug] --> B{Chọn thao tác}
  B -->|Xóa dữ liệu| C[confirm 1 bước]
  B -->|Xóa chi nhánh| D[confirm 1 bước]
  C --> E[reviews:cleanupByPlace]
  E --> F[refresh trang hiện tại]
  D --> G[places:removeBranch]
  G --> H[router.push('/')]
  H --> I[refresh dashboard]
```

# V. Files Impacted (Tệp bị ảnh hưởng)
- Sửa: `online-reputation-management-system/convex/places.ts`
  - Vai trò hiện tại: query/upsert dữ liệu chi nhánh.
  - Thay đổi: thêm mutation xóa chi nhánh và cascade xóa reviews + metrics theo `placeId`.

- Sửa: `online-reputation-management-system/src/components/dashboard/views/PlaceDetailView.tsx`
  - Vai trò hiện tại: render trang chi tiết chi nhánh và lọc/phân trang reviews.
  - Thay đổi: thêm 2 nút riêng + confirm + gọi mutation tương ứng + xử lý loading/redirect/refresh.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc lại style hiện có trong `PlaceDetailView` để đặt UI mới đồng bộ.
2. Thêm mutation `places:removeBranch` trong Convex.
3. Nối handler UI cho 2 nút xóa ở `PlaceDetailView`.
4. Rà tĩnh TypeScript/null-safety và edge case idempotent.
5. Commit thay đổi (không push).

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Audit Summary:
  - Verify bằng việc quan sát data trước/sau trên UI route `/` và `/:slug` + response từ mutation.
- Root Cause Confidence:
  - High: chức năng thiếu do chưa có wiring UI + thiếu mutation xóa chi nhánh.
- Verification steps:
  1. Manual repro: vào `/test-place--p1`, bấm “Xóa dữ liệu chi nhánh”, confirm Yes.
     - Pass: trang còn tồn tại, danh sách review về rỗng, metrics liên quan giảm về 0.
  2. Manual repro: vào `/test-place--p1`, bấm “Xóa chi nhánh”, confirm Yes.
     - Pass: bị chuyển về `/`, sidebar không còn branch đó; truy cập lại slug cũ ra notFound.
  3. Chạy `bunx tsc --noEmit` vì có thay đổi TS/code (theo rule repo).

# VIII. Todo
1. Thêm mutation `places:removeBranch` để xóa branch + related data.
2. Thêm 2 nút thao tác riêng trong `PlaceDetailView`.
3. Wiring call mutation + confirm + loading/error.
4. Điều hướng/refresh sau thao tác theo từng loại.
5. Rà tĩnh TypeScript và commit.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Có đúng 2 thao tác riêng ở trang `/:slug`.
- “Xóa dữ liệu chi nhánh” chỉ xóa `reviews` + `branchDailyMetrics`, không xóa `places`.
- “Xóa chi nhánh” xóa `places` + toàn bộ dữ liệu liên quan theo `placeId`.
- Cả hai thao tác có confirm 1 bước.
- Sau “xóa chi nhánh”, branch biến mất khỏi dashboard/sidebar và slug cũ không truy cập được.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro:
  - Xóa nhầm dữ liệu thật (hành động destructive).
  - Race condition nhỏ nếu click liên tiếp.
- Giảm thiểu:
  - Confirm trước khi xóa + disable nút khi đang xử lý.
  - Mutation idempotent khi record đã không còn.
- Rollback:
  - Không rollback tự động; cần re-seed/import lại branch từ nguồn chính thức nếu xóa nhầm.

# XI. Out of Scope (Ngoài phạm vi)
- Không làm soft-delete/khôi phục.
- Không thêm phân quyền người dùng.
- Không chỉnh schema Convex hoặc tạo UI quản trị mới ngoài trang `/:slug`.

# XII. Open Questions (Câu hỏi mở)
- Không còn ambiguity sau khi anh đã chốt: phạm vi xóa, vị trí nút, kiểu confirm.