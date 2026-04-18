# I. Primer
## 1. TL;DR kiểu Feynman
- Hiện tại trang `/<slug>` chỉ fetch 24 review của **trang hiện tại**, nên bấm tag (Service/Food/...) chỉ lọc trong 24 review đó.
- Em sẽ đổi sang cơ chế lọc theo **toàn bộ tập review của place** ở backend rồi mới phân trang.
- Tag sẽ được Việt hóa dễ hiểu (ví dụ: Dịch vụ, Đồ ăn, Vệ sinh, Trải nghiệm, Giá cả).
- Trạng thái filter/search/sort sẽ lưu trên URL; đổi filter sẽ tự về `page=1`.
- Fix lỗi link trang 1 thành URL sạch, không còn tình trạng `...#`.

## 2. Elaboration & Self-Explanation
Lỗi gốc ở chỗ: UI đang lọc sau khi đã nhận dữ liệu phân trang 24 item. Điều này khiến filter “Service/Food” không phản ánh toàn bộ dữ liệu, vì dữ liệu ngoài trang hiện tại chưa được tải.

Để đúng kỳ vọng, thứ tự phải là:
1) nhận điều kiện filter/search/sort,
2) backend query toàn bộ tập theo điều kiện,
3) backend trả page đúng (24 item), total đúng theo điều kiện,
4) UI render và paginate theo dataset đã lọc.

Ngoài ra, hiện `buildPageHref(1)` đang trả `''` (chuỗi rỗng), đi vào `<Link href="">` có thể gây điều hướng lạ (`...#`). Cần trả `'?' + query không có page` hoặc đường dẫn hiện tại ổn định.

## 3. Concrete Examples & Analogies
Ví dụ:
- Place có 500 review, tag “Dịch vụ” có 120 review.
- Khi chọn “Dịch vụ”, backend trả `total=120`, `totalPages=5` (24/trang), page 1 hiển thị 24 review dịch vụ mới nhất.
- Bấm trang 2 sẽ ra review dịch vụ 25–48, không bị lẫn review ngoài dịch vụ.

Analogy:
- Cách cũ: lọc trong 1 khay 24 tờ giấy đang cầm trên tay.
- Cách mới: lọc trong cả tủ hồ sơ, rồi mới lấy 24 tờ cho từng trang.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: `src/app/[slug]/page.tsx` chỉ gọi `reviews:paginatedByPlace` với `page/limit`, chưa truyền filter/search/sort.
- Observation: `src/components/dashboard/views/PlaceDetailView.tsx` đang lọc ở client trên `reviews` (chỉ là 24 item của page hiện tại).
- Observation: `buildPageHref(1)` hiện có thể trả chuỗi rỗng `''`.
- Observation: `TAG_MAP` key tiếng Anh trong `src/components/dashboard/utils.ts`.
- Inference: Filter không toàn cục vì thực hiện hậu phân trang.
- Decision: chuyển filter/sort/search vào query server-side + đồng bộ URL params.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
1. Triệu chứng: bấm tag không lọc toàn bộ; paginate trang 1 có lúc điều hướng lỗi `...#`.
2. Phạm vi: route `/<slug>` (PlaceDetailView + page server).
3. Tái hiện: ổn định khi place có nhiều review > 24.
4. Mốc thay đổi: khi tách route slug + page size 24, filter vẫn giữ ở client local.
5. Thiếu dữ liệu: chưa có log URL params cho từng thao tác filter/page ở browser.
6. Giả thuyết thay thế: dữ liệu tag map thiếu keyword nên cảm giác lọc sai; đúng nhưng không giải thích lỗi “chỉ trong trang hiện tại”.
7. Rủi ro fix sai nguyên nhân: chỉ Việt hóa nhãn mà không đổi tầng query thì bug logic còn nguyên.
8. Pass/fail: chọn tag bất kỳ phải đổi total/pages theo toàn dataset và reset page 1; bấm page 1 không lỗi.

**Root Cause Confidence:** High — evidence trực tiếp từ luồng data client-side filtering sau pagination.

# IV. Proposal (Đề xuất)
## 1. Chuẩn hóa contract query (server-side filtering)
- Mở rộng query Convex `reviews:paginatedByPlace` để nhận thêm:
  - `q` (search text),
  - `tags` (mảng tag key nội bộ),
  - `sort` (`date_desc` | `date_asc`).
- Query sẽ filter/sort trước, sau đó mới `slice` theo `page/limit`.

## 2. Đồng bộ URL params cho trạng thái lọc
- Dùng URL params trên `/<slug>`: `page`, `q`, `tags`, `sort`.
- Mọi thao tác đổi `q/tags/sort` sẽ tự set `page=1`.
- `buildPageHref` trả URL hợp lệ tuyệt đối (không rỗng), tránh `...#`.

## 3. Việt hóa tag hiển thị nhưng giữ key ổn định
- Giữ key kỹ thuật nội bộ (vd `service`, `food`, `cleanliness`, `experience`, `price`) để query ổn định.
- Thêm label tiếng Việt để render UI:
  - Dịch vụ, Đồ ăn, Vệ sinh, Trải nghiệm, Giá cả.

## 4. Điều chỉnh PlaceDetailView
- Bỏ filter logic local trên mảng `reviews` 24 item.
- Render theo dữ liệu server đã lọc.
- UI control cập nhật URL query thay vì chỉ setState.

```mermaid
flowchart TD
  A[User chọn tag/search/sort] --> B[Update URL params]
  B --> C[/[slug] server page]
  C --> D[Convex query filter+sort toàn bộ]
  D --> E[Paginate 24/item]
  E --> F[Render reviews + total + page]
```

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `online-reputation-management-system/convex/reviews.ts`  
  Vai trò hiện tại: phân trang cơ bản theo place.  
  Thay đổi: thêm tham số filter/search/sort và áp dụng trước pagination.

- **Sửa:** `online-reputation-management-system/src/app/[slug]/page.tsx`  
  Vai trò hiện tại: đọc `page` và gọi query đơn giản.  
  Thay đổi: đọc thêm `q/tags/sort` từ URL, truyền vào query, trả dữ liệu đã lọc.

- **Sửa:** `online-reputation-management-system/src/components/dashboard/views/PlaceDetailView.tsx`  
  Vai trò hiện tại: filter/sort local trên page data.  
  Thay đổi: control URL params, reset page về 1 khi đổi filter, fix build link page 1.

- **Sửa:** `online-reputation-management-system/src/components/dashboard/utils.ts`  
  Vai trò hiện tại: TAG_MAP key tiếng Anh hiển thị trực tiếp.  
  Thay đổi: tách key ổn định + label tiếng Việt để render dễ hiểu.

# VI. Execution Preview (Xem trước thực thi)
1. Chuẩn hóa model tag (key + label) trong `utils.ts`.
2. Nâng cấp query `reviews:paginatedByPlace` hỗ trợ filter/search/sort.
3. Cập nhật server page `/[slug]` đọc URL params và gọi query mới.
4. Refactor PlaceDetailView: bỏ filter local, push params lên URL, reset page=1 khi đổi filter.
5. Sửa helper build href để page 1 luôn ra URL hợp lệ.
6. Tự review tĩnh và chạy typecheck.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Static:
  - Soát type params `q/tags/sort/page` từ URL.
  - Soát fallback khi params sai định dạng.
- Typecheck:
  - `bunx tsc --noEmit` (do có đổi code TS).
- Repro cho tester:
  1) Vào route `/<slug>`, chọn “Dịch vụ” -> total/pages phải đổi theo toàn dataset.
  2) Đang ở page >1, đổi filter -> tự về page 1.
  3) Bấm trang 1 nhiều lần không xuất hiện `...#`/URL lỗi.
  4) Tag hiển thị tiếng Việt rõ nghĩa.

# VIII. Todo
1. Refactor TAG_MAP sang key ổn định + nhãn tiếng Việt.
2. Mở rộng query Convex cho lọc toàn cục trước phân trang.
3. Đồng bộ URL params `q/tags/sort/page` ở route `/[slug]`.
4. Sửa PlaceDetailView để dùng server-filtered data.
5. Fix link pagination trang 1 không lỗi.
6. Typecheck và commit.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Chọn tag (Dịch vụ/Đồ ăn/...) lọc trên toàn bộ review của place, không chỉ trang hiện tại.
- Đổi filter/search/sort tự động đưa về trang 1.
- Bấm trang 1 không sinh URL lỗi `...#`.
- Tag hiển thị tiếng Việt dễ hiểu.
- `total` và `totalPages` phản ánh đúng tập dữ liệu đã lọc.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro performance nếu filter toàn bộ bằng `.collect()` khi dataset lớn.
- Giảm thiểu: giữ giới hạn place-level và tối ưu bước lọc text/tag đơn giản; nếu cần sẽ tối ưu index theo pha sau.
- Rollback: tắt query params filter mới và quay về luồng cũ của `/[slug]`.

# XI. Out of Scope (Ngoài phạm vi)
- Không thay đổi crawler/sync pipeline.
- Không thay schema DB.
- Không redesign UI ngoài các control filter/pagination liên quan bug hiện tại.