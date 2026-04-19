# I. Primer
## 1. TL;DR kiểu Feynman
- **Có, khả năng cao sẽ nhanh hơn** trong đoạn giữa (khi còn nhiều review mới).
- Mức kỳ vọng thực tế: **~15–30%** tổng thời gian, không phải 3x.
- Ở tail (cuối danh sách), lợi ích giảm vì không đủ review mới để gom 30.

## 2. Elaboration & Self-Explanation
Tăng target/iteration giúp giảm số vòng lặp outer-loop, nên bớt overhead lặp (scroll-check-log-wait). Vì vậy thường nhanh hơn. Nhưng không thể nhanh gấp 3 vì mỗi vòng lớn hơn cũng tốn thêm thời gian gom card/stale handling.

## 3. Concrete Examples & Analogies
- Nếu trước trung bình 10 review/vòng, giờ gom ~25–30/vòng ở đoạn dày, thì số vòng giảm đáng kể.
- Nhưng ở đoạn cuối chỉ còn ít review mới, vẫn phải lăn lâu để kiếm thêm nên lợi ích co lại.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: log hiện tại lặp nhiều vòng +10 review, đặc biệt tail rất chậm.
- Inference: giảm số vòng là hướng hợp lý để tăng tốc.
- Decision: thay đổi này đáng làm, nhưng chỉ là tối ưu mức vừa.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root Cause Confidence: **Medium-High**
- Có thể không cải thiện mạnh nếu bị throttle/network hoặc tail quá nặng.

# IV. Proposal (Đề xuất)
- Chốt: làm thay đổi target 30 như bạn yêu cầu.
- Kỳ vọng outcome:
  - Mid-phase: nhanh rõ.
  - Tail-phase: nhanh ít hơn.

# V. Files Impacted (Tệp bị ảnh hưởng)
- `google-review-craw/modules/scraper.py` (1 file).

# VI. Execution Preview (Xem trước thực thi)
1. Thêm target 30.
2. Gom thêm card trong cùng iteration.
3. Giữ nguyên phần còn lại.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- So trước/sau theo `seconds_per_100_reviews`.
- Quan sát log iteration mới có thường >10 và gần 30 ở đoạn giữa.

# VIII. Todo
1. Áp thay đổi target 30.
2. Đối chiếu runtime trước/sau.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Tổng runtime giảm ít nhất ~15% mà không hụt dữ liệu.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Risk: tail có thể không cải thiện nhiều.
- Rollback: revert 1 file.

# XI. Out of Scope (Ngoài phạm vi)
- Không thêm tối ưu khác.

# XII. Open Questions (Câu hỏi mở)
- Không có.