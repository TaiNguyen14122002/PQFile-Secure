# Trang chủ thống kê PQFile Secure — 21/11/2026

## Thay đổi

- `/dashboard`: trang tổng quan bám sát thiết kế ảnh tham chiếu (banner, 4 thẻ chỉ số, đường theo tháng, biểu đồ vành khuyên, biểu đồ cột, hoạt động gần đây).
- `/upload`: màn hình tải lên và mã hóa cũ được giữ nguyên **cả mã nguồn lẫn chức năng**, truy cập từ nút **Tải lên & mã hóa** trên banner trang chủ.
- `GET /api/dashboard/overview`: API xác thực và lọc dữ liệu theo `req.user.id`. Không gửi ciphertext, khóa riêng tư hoặc nội dung tệp về dashboard.
- Tất cả dữ liệu đều lấy từ PostgreSQL (không chèn số mẫu 1248, 367 hay phần trăm ngẫu nhiên).
- Responsive: 4/3/3 cột trên desktop, tự chuyển về 2/1 cột trên màn hình nhỏ.
- Không thêm thư viện UI hoặc chart mới.

## Cách diễn giải chỉ số (quan trọng cho báo cáo nghiên cứu)

- **Tổng số tệp tin**: số tệp đang hoạt động mà tài khoản sở hữu hoặc đang được nhận chia sẻ còn hạn (đếm tệp duy nhất).
- **Lượt chia sẻ**: quyền chia sẻ do tài khoản cấp, chưa thu hồi/chưa hết hạn, của tệp đang hoạt động.
- **Tệp đã mã hóa**: số tệp đang hoạt động do tài khoản sở hữu; trong kiến trúc này, tệp được tạo thông qua luồng mã hóa trước khi tải lên.
- **Nhóm làm việc**: số nhóm tài khoản có tư cách thành viên.
- **Xu hướng tăng/giảm** ở hai thẻ đầu: so sánh lượng **tệp do tài khoản tải lên** hoặc **lượt chia sẻ được tạo** trong tháng hiện tại và tháng trước. Khi tháng trước bằng 0, hiển thị chưa có mốc so sánh; không hiển thị phần trăm suy đoán.
- **Đồ thị theo tháng**: 7 tháng gần nhất; đường tải lên đếm các tệp *đang còn hoạt động* theo tháng tạo, đường chia sẻ đếm lượt cấp quyền đã ghi nhận theo tháng tạo (kể cả lần sau đó thu hồi). Xóa vĩnh viễn có thể khiến biểu đồ lịch sử tệp không còn đầy đủ.
- **Loại tệp**: phân loại từ đuôi tên `displayLabel`, không phải kiểm tra MIME hoặc nội dung tệp.
- **Biểu đồ chức năng**: số tệp truy cập được, chia sẻ còn hiệu lực, tệp mã hóa của tài khoản, nhóm tài khoản tham gia và tổng bản ghi hoạt động của tài khoản. Đây là các số lượng theo trạng thái hiện tại, **không phải tổng số lượt thực hiện từng thao tác**.
- **Thông tin bảo vệ**: tỷ lệ có các trường metadata AES-256-GCM, chữ ký và quyền chia sẻ chưa hết hạn. **Không phải kết quả xác thực chữ ký, kiểm tra tệp trước giải mã, kiểm toán an ninh, hoặc tỷ lệ “an toàn” được kiểm chứng**.
- **Trạng thái metadata**: phân loại đủ trường / đủ chữ ký nhưng thiếu các trường khác / thiếu metadata chữ ký. Các nhóm này **không đại diện cho mức độ rủi ro**.
- **Hoạt động gần đây**: 3 sự kiện gần nhất của người đang đăng nhập, chỉ thêm tên tệp khi tệp đó vẫn còn quyền truy cập.

## Kiểm tra sau cập nhật

1. Đăng nhập tài khoản không có dữ liệu: tổng số bằng 0, biểu đồ không hiện số giả, phần trăm không có mẫu hiển thị dấu `—`.
2. Mở `/dashboard`, tải lại và kiểm tra các yêu cầu `GET /api/dashboard/overview` trả về `200` khi đăng nhập, `401` khi chưa xác thực.
3. Mở `/upload`, mã hóa một tệp thử nghiệm, quay lại dashboard và chọn Làm mới; kiểm tra bộ đếm và biểu đồ.
4. Chia sẻ một tệp cho tài khoản thử, thu hồi và kiểm tra bộ đếm chia sẻ thay đổi.
5. Đăng nhập tài khoản thứ hai và xác nhận **không xuất hiện** dữ liệu cá nhân của tài khoản thứ nhất khi chưa chia sẻ.
6. Thử độ rộng trình duyệt 1680, 1024, 768, 390 pixel; kiểm tra không tràn ngang, thanh điều hướng điện thoại vẫn hoạt động.
7. Kiểm tra các màn hình Tệp tin, Chia sẻ, Khóa mật mã, Nhóm làm việc và Lịch sử không bị ảnh hưởng.
8. Kiểm tra API với nhiều dữ liệu; với kho rất lớn nên nâng cấp sang tổng hợp/nhóm trực tiếp bằng truy vấn SQL thay vì nạp danh sách metadata tại tầng API.

## Phạm vi xác minh

Đã kiểm tra cú pháp script TypeScript và cấu trúc của các tệp mới. Môi trường tạo bản vá không tải được gói npm nên chưa thể xác thực bản build Nuxt/NestJS hoặc luồng Docker/DB thật. Không dùng dashboard như chứng cứ kiểm định ML-KEM/ML-DSA; kết quả mật mã phải có kiểm thử độc lập.
