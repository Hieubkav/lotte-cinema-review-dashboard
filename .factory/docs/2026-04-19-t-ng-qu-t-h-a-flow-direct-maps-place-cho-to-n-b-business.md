# I. Primer
## 1. TL;DR kiểu Feynman
- Anh chốt: mọi link direct `google.com/maps/place/...` sẽ **luôn refresh 1 lần**.
- Với direct links, mình **bỏ validate placeId** trước khi vào bước click Reviews.
- Nếu direct URL bị redirect sang search/list thì **không fallback chọn card**; cứ giữ triết lý direct vào thẳng.
- Sau khi vào Reviews, dùng flow scrape chung hiện tại (như Lotte), không tách nhánh riêng.

## 2. Elaboration & Self-Explanation
Hiện code đang có nhiều nhánh đặc thù xoay quanh Nhà cafe và placeId. Anh muốn đơn giản hóa cho toàn bộ direct links: vào link trực tiếp thì xử lý trực tiếp, tránh thêm logic fallback rẽ nhánh làm phức tạp và khó kiểm soát.

Vì vậy em đề xuất chuẩn hóa pipeline như sau:
1) nhận diện direct URL,
2) load + refresh 1 lần cố định,
3) bỏ xác thực placeId ở nhánh direct,
4) đi thẳng vào click Reviews và scrape theo flow chung.

Mục tiêu là giảm branching và làm behavior nhất quán cho mọi business dùng direct URL.

## 3. Concrete Examples & Analogies
- Ví dụ với Nhà cafe và các quán direct khác:
  - Input: `https://www.google.com/maps/place/...`
  - Runtime: `driver.get(url)` -> `driver.refresh()` -> `click_reviews_tab()` -> scrape loop.
- Không làm nữa:
  - không bắt match `custom_params.placeId`
  - không fallback sang search/query_place_id/click card.
- Analogy: đã có “địa chỉ nhà chính xác” thì cứ đi thẳng vào nhà, không quay lại bản đồ tổng rồi chọn lại.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - Code có helper nhận diện direct URL và refresh.
  - Code vẫn có nhánh strict `SPECIAL_PLACEID_NHA_CAFE` + fallback validate placeId.
- Inference:
  - Với yêu cầu mới, nhánh strict theo placeId là dư thừa và tạo khác biệt hành vi giữa direct links.
- Decision:
  - Chuẩn hóa thành một flow direct chung, bỏ placeId validation/fallback trong navigate direct.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- 1) Triệu chứng: flow điều hướng còn phân nhánh phức tạp theo placeId đặc thù.
- 2) Phạm vi: `navigate_to_place()` và helper validate liên quan direct candidates.
- 3) Tái hiện: luôn thấy khi chạy business direct.
- 4) Mốc thay đổi: đã thêm nhiều fix incremental cho Nhà cafe trước đó.
- 5) Dữ liệu thiếu: không cần thêm để thực hiện chuẩn hóa theo quyết định của anh.
- 6) Giả thuyết thay thế: giữ placeId validation để an toàn hơn; nhưng anh đã chọn bỏ để đơn giản hóa và nhất quán direct flow.
- 7) Rủi ro nếu fix sai: direct URL redirect bất thường có thể đi lệch place mà không bị chặn.
- 8) Pass/fail: log direct flow không còn nhánh validate/fallback theo placeId.

**Root Cause Confidence (Độ tin cậy nguyên nhân gốc): High**
- Vì đây là quyết định behavior do yêu cầu sản phẩm, không phải suy đoán kỹ thuật mơ hồ.

```mermaid
flowchart TD
  A[Input URL] --> B{is /maps/place/ ?}
  B -- Yes --> C[driver.get(url)]
  C --> D[refresh 1 lần]
  D --> E[click Reviews]
  E --> F[scrape flow chung]
  B -- No --> G[flow hiện hữu non-direct]
  G --> F
```

# IV. Proposal (Đề xuất)
- Sửa `google-review-craw/modules/scraper.py`:
  1) Trong `navigate_to_place()`, với direct URL:
     - luôn đi theo `get + refresh 1 lần`,
     - bỏ nhánh strict validate placeId cho direct links.
  2) Loại bỏ/giảm phụ thuộc vào `SPECIAL_PLACEID_NHA_CAFE` trong phần navigate (nếu không còn dùng).
  3) Giữ nguyên các flow khác (search URL, non-direct URL) để không mở rộng scope.

- Không đổi:
  - logic scrape loop sau khi vào Reviews,
  - config schema hiện tại,
  - DB/pipeline sync.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `google-review-craw/modules/scraper.py`
  - Vai trò hiện tại: điều hướng vào place và mở tab reviews trước khi scrape.
  - Thay đổi: chuẩn hóa direct links thành 1 flow cố định (refresh 1 lần, không placeId validation/fallback).

# VI. Execution Preview (Xem trước thực thi)
1. Đọc block navigate direct + nhánh `SPECIAL_PLACEID_NHA_CAFE`.
2. Rút gọn thành direct flow chung theo quyết định mới.
3. Giữ non-direct flow nguyên trạng.
4. Rà diff tĩnh để đảm bảo thay đổi tập trung 1 file.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Theo rule repo: không tự chạy lint/unit test.
- Kiểm chứng runtime bằng lệnh headed hiện tại.
- Kỳ vọng log:
  - direct URL luôn có log refresh 1 lần,
  - không còn log validate mismatch/fallback theo placeId cho direct,
  - vào Reviews và chạy scrape flow chung.

# VIII. Todo
- [ ] Rút gọn navigate direct flow: get + refresh 1 lần.
- [ ] Bỏ placeId validation/fallback trong direct path.
- [ ] Rà diff tĩnh, giữ scope tối thiểu.
- [ ] Commit local (không push), kèm file spec.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Tất cả URL `maps/place` dùng cùng direct flow thống nhất.
- Không còn kiểm tra/ép match `placeId` ở direct path.
- Không fallback chọn card/list cho direct path.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro: khi Google redirect bất thường, có thể không phát hiện lệch place sớm do bỏ validate.
- Rollback: revert commit để quay lại strict-validate cũ.

# XI. Out of Scope (Ngoài phạm vi)
- Không refactor lại thuật toán click tab/sort/scroll.
- Không thay đổi config/seed cho từng business.
- Không thay đổi modules khác ngoài scraper navigate path.