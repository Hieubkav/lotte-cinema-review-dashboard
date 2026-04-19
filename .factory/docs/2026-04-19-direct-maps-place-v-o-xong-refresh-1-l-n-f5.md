# I. Primer
## 1. TL;DR kiểu Feynman
- Anh chốt rằng với URL direct `https://www.google.com/maps/place/...` thì cứ vào xong **F5 1 lần** là chạy ổn.
- Em sẽ thêm 1 hook nhỏ trong `navigate_to_place()` để tự refresh 1 lần cho **mọi URL dạng maps/place**.
- Đồng thời giữ config Nhà cafe dùng đúng direct URL anh đưa.
- Không đụng flow business khác ngoài việc nhận diện URL direct-place.

## 2. Elaboration & Self-Explanation
Hiện scraper có nhiều nhánh để xử lý search/list/place. Với direct-place link, anh đã xác nhận thao tác tay “mở xong F5” giúp vào trạng thái cào ổn định. Vậy cách ít rủi ro nhất là mã hóa đúng hành vi này vào code: nếu input URL là `google.com/maps/place/...` thì sau `driver.get(url)` sẽ `driver.refresh()` một lần, chờ ngắn rồi chạy các bước tiếp theo (dismiss cookies, vào reviews tab, scrape).

Mục tiêu là biến thao tác thủ công của anh thành hành vi tự động, nhất quán, không cần thay đổi thuật toán nhận diện review phức tạp.

## 3. Concrete Examples & Analogies
- Ví dụ:
  - Input URL: `https://www.google.com/maps/place/Nh%C3%A0+cafe/...`
  - Flow mới:
    1) `driver.get(url)`
    2) `driver.refresh()` đúng 1 lần
    3) tiếp tục quy trình click reviews/scrape
- Analogy: như mở app lần đầu hay bị “khựng state”, bấm reload 1 cái là UI vào đúng mode làm việc.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - `config.yaml` đã có entry Nhà cafe với `placeId` đặc biệt.
  - `modules/scraper.py` có luồng navigation riêng cho Nhà cafe và luồng chung direct URL.
- Inference:
  - Refresh sau khi load direct-place là thay đổi nhỏ, bám đúng evidence thao tác runtime của anh.
- Decision:
  - Áp dụng refresh 1 lần cho **mọi URL dạng direct maps/place** (đúng theo trả lời của anh).

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- 1) Triệu chứng: direct URL có thể chưa vào state tối ưu scrape ngay lần load đầu.
- 2) Phạm vi: các business dùng URL `.../maps/place/...`.
- 3) Tái hiện: theo vận hành thực tế của anh, F5 sau khi vào direct giúp ổn định.
- 4) Mốc thay đổi: hiện chưa có auto-refresh cho direct-place.
- 5) Thiếu dữ liệu: chưa có metric pass-rate trước/sau qua nhiều run tự động.
- 6) Giả thuyết thay thế: anti-bot/session/cookie cũng có thể góp phần.
- 7) Rủi ro fix sai: thêm delay nhỏ nhưng không tăng ổn định đáng kể.
- 8) Pass/fail: run headed thấy direct-place vào scrape flow ổn định hơn, không cần thao tác tay F5.

**Root Cause Confidence (Độ tin cậy nguyên nhân gốc): Medium-High**
- Lý do: có evidence runtime cụ thể từ user + thay đổi rất nhỏ, đúng hành vi đã chứng minh thủ công.

```mermaid
flowchart TD
  A[Input URL] --> B{contains /maps/place/ ?}
  B -- Yes --> C[driver.get(url)]
  C --> D[refresh 1 lần]
  D --> E[tiếp tục click reviews + scrape]
  B -- No --> F[flow hiện tại]
  F --> E
```

# IV. Proposal (Đề xuất)
- Sửa code tại `modules/scraper.py`:
  - Thêm helper nhận diện direct-place URL (`google.com/maps/place/`).
  - Trong navigation path dùng direct URL: sau `driver.get(url)` thực hiện `driver.refresh()` 1 lần, sleep ngắn, rồi chạy tiếp.
- Sửa cấu hình tại `google-review-craw/config.yaml`:
  - Đảm bảo entry “Nhà cafe” dùng đúng direct URL anh cung cấp.
  - Giữ nguyên `custom_params.placeId` hiện có.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `google-review-craw/modules/scraper.py`
  - Vai trò hiện tại: điều hướng vào Google Maps và khởi động luồng cào reviews.
  - Thay đổi: thêm bước auto-refresh 1 lần cho URL direct `maps/place`.
- **Sửa:** `google-review-craw/config.yaml`
  - Vai trò hiện tại: nguồn URL/business đầu vào cho lệnh scrape.
  - Thay đổi: giữ/đặt URL Nhà cafe về direct `maps/place` anh chỉ định.

# VI. Execution Preview (Xem trước thực thi)
1. Chỉnh `scraper.py` để nhận diện direct-place URL.
2. Chèn refresh 1 lần ngay sau khi mở direct-place.
3. Chỉnh `config.yaml` entry Nhà cafe sang direct URL (nếu chưa đúng).
4. Review diff tĩnh để chắc chỉ đổi đúng scope.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Theo rule repo: không tự chạy lint/unit test.
- Runtime verify theo lệnh anh dùng:
  - `.\.venv\Scripts\python.exe start.py scrape --config config.yaml --headed`
- Điểm cần quan sát:
  - Với direct-place URL: browser auto-refresh đúng 1 lần.
  - Flow tiếp tục scrape mà không cần thao tác tay F5.

# VIII. Todo
- [ ] Thêm auto-refresh 1 lần cho direct maps/place URL.
- [ ] Đảm bảo config Nhà cafe dùng direct URL đã chốt.
- [ ] Rà diff tĩnh, không mở rộng scope.
- [ ] Commit local (không push).

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- URL direct `maps/place` sẽ luôn refresh 1 lần tự động sau khi mở.
- Entry Nhà cafe trong config dùng direct URL anh cung cấp.
- Không thay đổi logic cho URL không phải direct-place ngoài hành vi hiện hữu.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro: tăng thêm chút thời gian do một lần refresh.
- Rollback: bỏ đoạn refresh hook và/hoặc revert 1 commit.

# XI. Out of Scope (Ngoài phạm vi)
- Không refactor thuật toán click reviews tab.
- Không thay đổi DB/pipeline/sync Convex.
- Không tối ưu anti-bot sâu ngoài bước refresh 1 lần.

# XII. Open Questions (Câu hỏi mở)
- Không còn: anh đã chốt phạm vi, số lần refresh, và tiêu chí vận hành.