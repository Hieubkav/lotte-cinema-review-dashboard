# I. Primer
## 1. TL;DR kiểu Feynman
- Bạn thấy 101 review nhưng scraper dừng ở 40 vì đang dùng `len(seen)` (bao gồm review đã có sẵn trong DB) để kích hoạt giới hạn `max_reviews`.
- Với `max_reviews: 0`, code mới tự bật `adaptive_targets = [30,20,10]`, nên dễ dừng sớm khi `seen` đã lớn từ trước.
- Case Nhà cafe đang có `Total unique reviews in DB: 40`, nên lần chạy sau gần như chạm trần ngay dù chưa crawl thêm.
- Em đề xuất đổi điều kiện dừng sang **số review thu thập trong phiên hiện tại** (session delta), và tắt adaptive target cho Nhà cafe.

## 2. Elaboration & Self-Explanation
Log bạn đưa đã có bằng chứng rõ:
- `Stopping: Found 5 consecutive existing reviews`
- `Reached max_reviews limit (30), stopping.`
- `Adaptive max_reviews lowered to 10...`
- cuối cùng `Total unique reviews in DB: 40`

Vấn đề là biến `seen` đang là “tổng review đã biết trong DB + mới scrape”. Khi dùng biến này để so với `active_max_reviews`, scraper tưởng đã đủ quota và dừng, dù thực tế phiên hiện tại chưa crawl đủ 101.

Do đó fix đúng bản chất là:
1) dừng theo số review thu được trong phiên (`session_seen`) thay vì tổng DB;
2) với Nhà cafe (đã có hard-cap 100) thì không dùng adaptive 30/20/10 nữa để tránh tự bóp quota.

## 3. Concrete Examples & Analogies
- Ví dụ hiện tại:
  - DB đã có 40 review.
  - Run mới chưa thêm gì, nhưng `len(seen)=40`.
  - adaptive max=30 -> hệ thống nghĩ đã vượt quota và dừng ngay.
- Ví dụ sau fix:
  - DB vẫn có 40, nhưng `session_seen=0` lúc bắt đầu.
  - Chỉ khi phiên hiện tại thu đủ ngưỡng mới dừng.
- Analogy: giống đo “sản lượng ca hôm nay” nhưng lỡ cộng cả hàng tồn kho từ hôm qua nên báo đủ chỉ tiêu quá sớm.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation:
  - `modules/scraper.py` có `adaptive_targets = [30,20,10] if max_reviews == 0`.
  - Điều kiện dừng dùng `len(seen) >= active_max_reviews`.
  - `seen` được seed từ DB review IDs trước khi crawl.
  - Nhà cafe set `special_target_reviews = 100` nhưng vẫn bị max_reviews/adaptive chặn trước.
- Inference:
  - Root cause chính: sai biến đo quota (total seen thay vì session delta).
- Decision:
  - Tách rõ 2 counters: `existing_seen` và `session_seen`; áp dụng limit theo `session_seen`.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- 1) Triệu chứng: UI có 101 review, scraper dừng ở 40.
- 2) Phạm vi: logic dừng scroll cho mọi place có dữ liệu cũ, nặng hơn ở `max_reviews=0`.
- 3) Tái hiện: ổn định khi DB đã có review trước đó.
- 4) Mốc thay đổi: thêm adaptive targets 30/20/10 gần đây.
- 5) Thiếu dữ liệu: chưa có snapshot đầy đủ khởi tạo `seen`, nhưng log đã đủ để kết luận.
- 6) Giả thuyết thay thế: anti-bot/DOM lazy load có thể làm thiếu review; tuy nhiên log “Reached max_reviews limit (30)” xác nhận dừng logic trước.
- 7) Rủi ro nếu fix sai: crawl lâu hoặc dừng quá muộn.
- 8) Pass/fail: không còn dừng vì ngưỡng 30/20/10 khi session chưa thu đủ.

**Root Cause Confidence (Độ tin cậy nguyên nhân gốc): High**
- Vì có evidence trực tiếp từ log dừng và code path tương ứng.

```mermaid
flowchart TD
  A[Start run] --> B[Load existing IDs into seen]
  B --> C{max_reviews == 0}
  C -- Yes --> D[adaptive target = 30]
  D --> E{len(seen) >= 30?}
  E -- Yes --> F[Stop early at ~40]
  E -- No --> G[Continue scroll]
```

# IV. Proposal (Đề xuất)
- Sửa `google-review-craw/modules/scraper.py`:
  1) Tạo counter phiên hiện tại (ví dụ `session_seen_count`) chỉ tăng khi phát hiện ID mới trong run này.
  2) Đổi điều kiện `active_max_reviews`/`special_target_reviews` sang so với `session_seen_count` (hoặc delta từ `len(seen)-initial_seen_count`).
  3) Với Nhà cafe (`SPECIAL_PLACEID_NHA_CAFE`), tắt adaptive targets 30/20/10, giữ hard cap 100 theo session.
  4) Cập nhật log để hiển thị rõ `session_seen` vs `total_seen` nhằm debug minh bạch.

- Tuỳ chọn cấu hình (nếu bạn muốn):
  - `config.yaml` đặt `stop_threshold: 0` riêng cho Nhà cafe để giảm nguy cơ dừng bởi “existing consecutive”.
  - Mặc định em giữ nguyên nếu chưa cần mở rộng scope.

# V. Files Impacted (Tệp bị ảnh hưởng)
- **Sửa:** `google-review-craw/modules/scraper.py`
  - Vai trò hiện tại: điều khiển vòng lặp scroll + điều kiện dừng.
  - Thay đổi: dừng theo session delta, không theo tổng DB seen; bypass adaptive cho Nhà cafe.
- **Không bắt buộc:** `google-review-craw/config.yaml`
  - Vai trò hiện tại: ngưỡng stop/scroll toàn cục.
  - Thay đổi (optional): chỉnh stop_threshold cho case đặc thù nếu bạn muốn.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc khu vực while-loop scrape và điểm cập nhật `seen`.
2. Thêm `initial_seen_count` + `session_seen_count`.
3. Đổi điều kiện stop `max_reviews`/`special_target_reviews` theo session counter.
4. Tắt adaptive target cho Nhà cafe.
5. Rà diff tĩnh, giữ thay đổi nhỏ và dễ rollback.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Theo rule repo: không tự chạy lint/unit test.
- Bạn chạy lại đúng lệnh headed hiện tại.
- Kỳ vọng log:
  - Không còn `Reached max_reviews limit (30)` khi mới có dữ liệu cũ.
  - Log hiển thị rõ session tăng dần (ví dụ 0 -> ...), total có thể >40.
  - Kết quả cuối tăng vượt 40, tiến gần 100/101 tùy giới hạn hard cap.

# VIII. Todo
- [ ] Refactor stop logic từ `len(seen)` sang `session_seen_count`.
- [ ] Disable adaptive 30/20/10 cho Nhà cafe.
- [ ] Bổ sung log session/total để dễ quan sát runtime.
- [ ] Commit local (không push), kèm spec doc.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Không còn dừng sớm ở mốc 30/40 do dữ liệu cũ trong DB.
- Case Nhà cafe crawl được vượt rõ rệt mốc 40 trong phiên chạy mới.
- Log thể hiện rõ lý do dừng hợp lệ (hard cap 100 hoặc exhaustion), không mơ hồ.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro: tăng thời gian chạy do không còn dừng sớm giả.
- Rollback: revert commit logic stop nếu cần quay về hành vi cũ.

# XI. Out of Scope (Ngoài phạm vi)
- Không chỉnh thuật toán click tab/sort thêm nữa.
- Không thay đổi pipeline lưu DB/Convex ngoài counter dừng scroll.
- Không tối ưu anti-bot hoặc network retries ở bước này.