Em đã đọc spec và sẽ triển khai **đúng full scope** như sau:

1) Cập nhật `TAG_MAP` theo key kỹ thuật ổn định + label tiếng Việt hiển thị.
2) Mở rộng `convex/reviews.ts` (`reviews:paginatedByPlace`) để nhận `q/tags/sort` và thực hiện **filter + sort trước**, sau đó mới paginate (24/item).
3) Cập nhật `src/app/[slug]/page.tsx` để parse URL params `page,q,tags,sort`, chuẩn hóa giá trị, truyền vào query mới.
4) Refactor `PlaceDetailView.tsx` để bỏ lọc local trên 24 item; chuyển toàn bộ thao tác filter/search/sort sang cập nhật URL params; đổi filter sẽ reset về `page=1`.
5) Sửa logic build href pagination để page 1 luôn ra URL hợp lệ (không `""`, không `...#`).
6) Tự review tĩnh + chạy `bunx tsc --noEmit`.
7) Commit toàn bộ thay đổi (không push), kèm `.factory/docs` theo guideline.

Kết quả kỳ vọng: lọc tag áp dụng trên toàn bộ dataset của place, total/totalPages chính xác theo filter, và pagination trang 1 không còn URL lỗi.