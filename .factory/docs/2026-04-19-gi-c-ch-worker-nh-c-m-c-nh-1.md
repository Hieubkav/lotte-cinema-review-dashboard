# I. Primer
## 1. TL;DR kiểu Feynman
- Mình sẽ **bỏ hướng “all worker”** như bạn nói.
- Giữ đúng behavior cũ: mặc định `scrape_workers = 1`.
- Không thêm prompt hỏi worker khi chọn ALL.
- Bạn sẽ tự scale bằng nhiều terminal riêng.

## 2. Elaboration & Self-Explanation
Yêu cầu của bạn đã rõ: ưu tiên kiểm soát thủ công bằng nhiều terminal, không muốn CLI tự hỏi/điều phối worker. Vì vậy hướng đúng là quay về cơ chế cũ đơn giản: một tiến trình scrape dùng 1 worker mặc định theo config hiện có.

## 3. Concrete Examples & Analogies
- Ví dụ: chạy `start.py scrape --config config.yaml --headed` với ALL sẽ quay về luồng cũ (không hỏi worker nâng cao).
- Nếu cần nhanh hơn, bạn tự mở thêm terminal và chia nhóm business để chạy song song thủ công.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: Bạn xác nhận muốn bỏ feature all-worker/prompt-worker.
- Inference: Cần giữ CLI scrape đơn giản, predictable.
- Decision: Revert phần worker prompt, giữ mặc định chạy 1.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root cause: nhu cầu vận hành thực tế ưu tiên tự điều phối nhiều terminal hơn là tự động worker trong 1 process.
- Counter-hypothesis: giữ prompt worker vẫn tiện hơn; nhưng không phù hợp preference hiện tại của bạn.
- Root Cause Confidence: High.

# IV. Proposal (Đề xuất)
- Revert toàn bộ thay đổi liên quan prompt chọn worker trong `start.py` và test tương ứng.
- Giữ `scrape_workers` theo config mặc định (1).

# V. Files Impacted (Tệp bị ảnh hưởng)
- Sửa: `google-review-craw/start.py` — bỏ hàm/prompt worker mới, trả về luồng cũ.
- Sửa: `google-review-craw/tests/test_start_commands.py` — bỏ test cho worker prompt mới.

# VI. Execution Preview (Xem trước thực thi)
1. Revert đoạn prompt worker trong `_run_scrape`.
2. Revert helper `_prompt_scrape_workers`.
3. Revert test mới cho worker prompt.
4. Review diff để đảm bảo behavior scrape quay về như cũ.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Static review diff: không còn logic hỏi worker khi ALL.
- Đảm bảo nhánh mặc định đọc `scrape_workers` và chạy như trước.

# VIII. Todo
- [ ] Revert `start.py` về behavior cũ (không prompt worker).
- [ ] Revert test mới liên quan worker prompt.
- [ ] Xác nhận lại diff sạch theo đúng yêu cầu.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Chọn ALL không còn prompt worker mới.
- Mặc định hoạt động như cũ với worker=1 (theo config hiện tại của bạn).
- Không có logic “all worker” trong CLI scrape.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro: tốc độ trong 1 process không tối đa.
- Rollback: không cần, vì đây là quay lại cơ chế cũ đã quen dùng.

# XI. Out of Scope (Ngoài phạm vi)
- Không tối ưu auto-parallel trong 1 process.
- Không thêm scheduling phức tạp.
