# PQFile Secure – Thông tin khóa mật mã trên Trang chủ

## Thay đổi

- Thêm bảng **Hồ sơ khóa mật mã** trong màn hình giới thiệu toàn màn hình của `/dashboard`.
- Hiển thị khóa công khai ML-KEM và ML-DSA đang hoạt động, thuật toán tương ứng, dấu vân tay khóa rút gọn và nút sao chép fingerprint đầy đủ.
- Trạng thái **Kho khóa cá nhân** được lấy từ bộ nhớ phiên tab qua `getUnlockedVault()` (không đồng nghĩa đã xác minh an toàn mật mã).
- Hiển thị thông tin kỹ thuật AES-256-GCM / Argon2id và lối tắt đến `/keys`.
- Ẩn bảng thông tin khi mở **Xem thống kê** để giữ không gian biểu đồ.
- Giao diện responsive và hỗ trợ giảm chuyển động.

## API và bảo mật

Dùng `GET /api/keys` (yêu cầu đăng nhập), dữ liệu khoá công khai của chính tài khoản hiện tại. Không truy cập API backup, không tải khóa riêng, không hiển thị mật khẩu.

Trạng thái kho khóa phản ánh khóa trong bộ nhớ tab hiện hành; đổi tab, đăng xuất hoặc khởi động lại có thể làm trạng thái thay đổi. Dữ liệu trạng thái có thể được cập nhật khi cửa sổ có tiêu điểm hoặc người dùng quay lại trang.

## Kiểm thử

1. Đăng nhập tài khoản chưa có khóa: hai dòng hiển thị “Chưa tạo”, có nút Quản lý khóa.
2. Tạo bộ khóa tại `/keys` và quay lại Trang chủ: thuật toán, fingerprint hiển thị theo API; nút Copy sao chép đầy đủ.
3. Mở/khóa kho khóa tại `/keys`, trở lại Trang chủ: kiểm tra nhãn trạng thái.
4. Mất kết nối API: giao diện báo lỗi và hỗ trợ Thử lại.
5. Nhấn Xem thống kê: bảng khóa ẩn, phần dashboard mở như trước; nhấn Ẩn thống kê trở về.
6. Trên màn hình nhỏ: bảng khóa xếp bên dưới nội dung giới thiệu, không đè nút tải lên.

Không thay đổi schema database, API backend, mã hóa tệp, hoặc dữ liệu đã lưu.
