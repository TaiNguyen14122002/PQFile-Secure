# Trang chủ – Thống kê luôn hiển thị (2026)

## Phạm vi

- Trang `/dashboard` hiển thị đồng thời banner giới thiệu, hồ sơ khóa công khai, bốn thẻ chỉ số và toàn bộ biểu đồ sau khi API `/dashboard/overview` trả dữ liệu. Không còn cơ chế nhấn nút mới tải/hiện thống kê.
- Liên kết “Xem các biểu đồ” chỉ cuộn xuống khu vực thống kê, không ẩn hoặc mở dữ liệu.
- Responsive: desktop hiển thị khối giới thiệu cạnh hồ sơ khóa; tablet và mobile xếp dọc, thu gọn chữ và giữ các thẻ biểu đồ không tràn ngang.
- Giữ ảnh campus/overlay do layout chung cung cấp; không tạo lớp nền thứ hai.
- Không chỉnh sửa API, kho khóa, cơ sở dữ liệu hoặc thuật toán mã hóa.

## Kiểm thử

1. Truy cập `/dashboard` ở màn hình 1680×1050, 1280×800, 768×1024 và 375×812. Không bấm nút nào vẫn thấy phần thống kê khi cuộn xuống.
2. Đảm bảo nút “Xem các biểu đồ” chỉ cuộn xuống phần thống kê, “Làm mới” vẫn gọi API.
3. Thử hồ sơ khóa đang có, chưa có và khi API lỗi. Không có khóa bí mật hiển thị.
4. Thu/phóng trình duyệt, thay đổi kích thước màn hình; không xuất hiện cuộn ngang.
5. Thử `prefers-reduced-motion: reduce` để kiểm tra không buộc người dùng xem hoạt ảnh.

Lưu ý: Cần thử Nuxt build và Docker trên máy triển khai; kiểm tra cú pháp tĩnh không thay thế kiểm thử trình duyệt.
