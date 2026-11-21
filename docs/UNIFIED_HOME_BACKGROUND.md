# Nền thống nhất cho Trang chủ (Dashboard)

- Dùng **một ảnh nền `/campus-background.jpg`** và **một lớp phủ xanh mờ** trong `.pq-dashboard` cho cả màn hình giới thiệu và khu vực thống kê.
- Bỏ ảnh riêng và lớp tô màu trong banner, bỏ lớp nền riêng của khu thống kê.
- Giữ nền trắng trong từng thẻ và biểu đồ để bảo đảm tương phản và khả năng đọc.
- Giữ hiệu ứng mở/thu gọn thống kê, dữ liệu API và xử lý sự kiện cũ.
- Không thay đổi PostgreSQL, RustFS, API, bộ dữ liệu seed hoặc các trang khác.

## Kiểm tra

1. Truy cập `/dashboard`, kiểm tra ảnh trường và lớp phủ xanh ở màn hình giới thiệu.
2. Bấm **Xem thống kê**: phần thống kê không còn nền xanh riêng; ảnh phía sau liên tục với banner.
3. Cuộn qua các biểu đồ, bấm **Thu gọn**, kiểm tra animation và các nút điều hướng.
4. Thử kích thước 1680×1050, 768px và điện thoại.

## Áp dụng

Chạy `git apply --check` trước, rồi `git apply` từ thư mục gốc dự án. Bản vá được tạo trên gói `PQFile-Secure-Fullscreen-Home-Statistics-Source.zip`.
