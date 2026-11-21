# PQFile Secure — Đồng bộ UI/UX các trang theo cấu trúc Thư viện tệp

## Phạm vi

Bản cập nhật lấy cấu trúc từ trang `/files` (banner → công cụ → nội dung nền trắng → danh sách và phân trang) và áp dụng thống nhất cho:

- `/dashboard`: banner xanh gọn, 4 thẻ thống kê, biểu đồ và hoạt động có thẻ đồng bộ.
- `/upload`: banner quy trình, khung kéo thả, khung cấu hình bảo mật hai cột ở màn hình rộng.
- `/keys`: kho khóa hai thẻ, nút/chú thích/trường nhập cùng ngôn ngữ thiết kế.
- `/workspaces`: danh sách nhóm và thành viên dạng hai vùng; màn hình cao cuộn độc lập từng danh sách.
- `/smart`: tìm kiếm và tóm tắt bên trái, lập chỉ mục bên phải; chỉ mục cuộn riêng khi phù hợp.
- `/security`: thẻ cảnh báo và bộ lọc; danh sách cuộn riêng, phân trang nằm ngoài danh sách ở màn hình lớn.
- `/governance`: banner, thống kê, tab theo kiểu thư viện, danh sách quyền + sơ đồ có vùng cuộn độc lập trên màn hình lớn.
- `/activity`: bộ lọc, thẻ nhật ký và thanh phân trang đồng bộ; vùng nhật ký cuộn riêng ở màn hình lớn.
- `/login`, `/register`: đồng bộ màu banner, thẻ và biểu mẫu; giữ bố cục đăng nhập/đăng ký riêng vì khác mục đích sử dụng.

## Hành vi responsive

- Màn hình nhỏ hơn 740px: một cột, nút thao tác lớn và bộ lọc xếp dọc; trang cuộn tự nhiên.
- Tablet/laptop: bố cục theo chiều rộng thực tế, không ép hai cột khi sidebar làm giảm diện tích.
- Desktop cao từ 1100px (rộng từ 1024px): cố định banner/các công cụ chính ở 5 trang nghiệp vụ; cho cuộn danh sách/khung bên trong để không mất phân trang.
- Desktop thấp hơn 1100px: không khóa trang, danh sách có chiều cao tối đa và tự cuộn để tránh che khuất các thao tác.
- Tôn trọng người dùng chọn giảm chuyển động (prefers-reduced-motion).

## Giới hạn thay đổi

- **Không sửa** `apps/web/pages/files.vue` — trang thư viện và logic chỉ cuộn danh sách của thư viện được giữ nguyên.
- **Không sửa** API, PostgreSQL, lưu trữ RustFS, dữ liệu Demo, thuật toán mã hóa, phân quyền, cơ chế giải mã/xác minh ML-DSA.
- Chỉ cập nhật CSS dùng chung mới, thêm class nhận diện style vào 10 trang và thuộc tính để dùng bàn phím cuộn danh sách (trên 5 trang); ẩn footer chung ở 5 trang nghiệp vụ để vùng cố định cao không sinh cuộn kép.

## Áp dụng PATCH trên MacBook

Lưu PATCH tại `/Volumes/Tai_Nguyen_256GB/NCKH/Source` và mở Terminal trong thư mục gốc `pqfile-secure`:

```bash
PATCH="/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Library_Style_All_Other_Pages_2026.patch"
ls -lh "$PATCH"
git apply --check "$PATCH"
git apply "$PATCH"
docker compose up -d --build web
```

**Chỉ chạy `git apply` nếu `--check` không báo lỗi**. Không áp dụng PATCH hai lần. Nếu đã có chỉnh sửa khác ở các trang, không dùng `git apply --reject` khi chưa đối chiếu xung đột.

Sau đó kiểm tra `/dashboard`, `/upload`, `/keys`, `/workspaces`, `/smart`, `/security`, `/governance`, `/activity`, `/login`, `/register` ở các độ rộng 320–1920px. Thử nhập bộ lọc, chọn một nhóm, mở sơ đồ quan hệ, cuộn danh sách cảnh báo, xem nút phân trang trên màn hình cao. Kiểm tra riêng `/files?tab=all` không đổi.

## Kiểm thử đã thực hiện

- CSS mới được phân tích cú pháp bằng PostCSS.
- 10 trang được kiểm tra có class thiết kế chung; các thay đổi ở Vue chỉ thuộc class và thuộc tính trợ năng của vùng cuộn.
- Chromium mô phỏng 5 trang nghiệp vụ × 8 kích thước màn hình (320, 360, 768, 1024, 1280, 1440, 1536, 1920px), không phát hiện tràn ngang.
- Chromium kiểm tra vùng danh sách cuộn độc lập trên màn hình cao 1440×1200; vị trí banner và thanh phân trang không di chuyển khi cuộn danh sách.
- Chưa thực hiện `nuxt build`/Docker hoặc thử với dữ liệu thật trên MacBook của người dùng. Kết quả Chromium là trên bố cục kiểm thử, không phải ảnh chụp ứng dụng hoàn chỉnh.
