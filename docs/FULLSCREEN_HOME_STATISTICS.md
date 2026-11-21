# Trang chủ toàn màn hình và thống kê mở bằng animation

## Thay đổi

- `/dashboard` luôn mở bằng banner PQFile Secure toàn màn hình, sau thanh điều hướng ngang.
- Banner sử dụng `campus-background.jpg` đã có sẵn, giữ lớp phủ gradient xanh đảm bảo độ tương phản chữ.
- Nút **Xem thống kê** mở phần thống kê; vùng hero thu gọn theo animation, vùng biểu đồ xuất hiện bằng hiệu ứng fade/slide và các thẻ hiện lần lượt.
- Nút **Ẩn thống kê** hoặc **Thu gọn** trở về màn hình giới thiệu.
- Tôn trọng tùy chọn `prefers-reduced-motion`; các nút hỗ trợ bàn phím và `aria-expanded`.
- Những số liệu và thành phần thống kê từ API `/dashboard/overview` được giữ nguyên. Không dùng số liệu minh họa, không sửa PostgreSQL hoặc RustFS.
- Chỉ ẩn footer của layout mặc định tại `/dashboard` để banner chiếm trọn viewport; các trang còn lại giữ nguyên.

## Kiểm thử thủ công

1. Đăng nhập và mở `/dashboard`: thấy banner chiếm toàn chiều cao khả dụng, **chưa hiển thị biểu đồ**.
2. Bấm **Xem thống kê**: banner thu gọn, các bảng thống kê/biểu đồ hiện tuần tự và trang cuộn đến vùng thống kê.
3. Bấm **Thu gọn** trên thanh công cụ: bảng thống kê ẩn và trang trở về đầu.
4. Bấm **Ẩn thống kê** trong banner: hoạt động tương tự.
5. Thử nút **Tải lên & mã hóa**: đến `/upload`, các trang khác không đổi.
6. Bật chế độ giảm chuyển động trên hệ điều hành: nội dung xuất hiện ngay, không có hoạt ảnh.
7. Kiểm tra ở 390x844, 768x1024, 1440x900, 1680x1050 và khi API lỗi hoặc chậm.

## Giới hạn

Thay đổi chỉ ở frontend. Cần `docker compose up -d --build` để xác nhận tương thích runtime tại máy người dùng.
