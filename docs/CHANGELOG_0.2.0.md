# PQFile Secure 0.2.0 — Bản nâng cấp từ mã nguồn đã cung cấp

> **Đây là bản cải tiến chức năng MVP, không phải chứng nhận an toàn bảo mật cho môi trường production.** Các bộ kiểm tra build/integration cần chạy trên máy có quyền tải phụ thuộc, Docker và kết nối dịch vụ.

## Đã thực hiện

### Giao diện
- Duy trì thanh điều hướng **ngang**, không có sidebar trái; duy trì ảnh `hero-school.jpg` làm banner trang chủ.
- Chuẩn hóa các thành phần giao diện dùng chung: tiêu đề, chỉ số, tab, hộp thoại, nút thao tác, trạng thái rỗng và phản hồi lỗi; responsive trên màn hình nhỏ.
- Trang chủ kéo thả nhiều tệp: loại tệp vượt 20 MiB, giới hạn 10 tệp/lượt, bỏ trùng, xử lý lỗi tải lên một phần **không làm mất hàng đợi tệp còn lại**.
- Trang Tệp tin: phân loại Tất cả / Của tôi / Được chia sẻ / Thùng rác; tìm kiếm theo nhãn, phân trang, giải mã, đổi nhãn, xóa mềm, khôi phục, xóa vĩnh viễn.
- Hộp thoại chia sẻ: tìm tài khoản, chọn fingerprint, thời hạn tùy chọn, danh sách người nhận, thu hồi quyền truy cập; hỗ trợ cấp lại quyền sau khi hết hạn hoặc thu hồi.
- Trang Được chia sẻ: giải mã và tải trực tiếp, tìm kiếm, xử lý thiếu quyền.
- Trang Nhóm làm việc: tạo/chọn nhóm, thêm người đã đăng ký, quản lý vai trò và xóa thành viên hoặc tự rời nhóm.
- Trang Lịch sử: lọc hành động, hiển thị các sự kiện mới.
- Trang Khóa mật mã: nạp bản sao lưu JSON từ thiết bị, xác thực khóa công khai sau khi mở, chuyển về bản sao máy chủ; quản lý khóa trong bộ nhớ và xóa tham chiếu khi đăng xuất.
- Thanh điều hướng đã bỏ chấm đỏ thông báo giả (chưa triển khai notification backend).

### API
- `GET /api/files/trash`: danh sách tệp trong thùng rác của chủ sở hữu.
- `PATCH /api/files/:id/label`: đổi nhãn hiển thị (không thay đổi tên tệp gốc lưu trong ciphertext).
- `POST /api/files/:id/restore`: khôi phục tệp đã xóa mềm.
- `DELETE /api/files/:id/permanent`: xóa ciphertext khỏi S3 và metadata sau khi đã chuyển vào thùng rác.
- `GET/POST/DELETE /api/files/:id/shares`: quản lý quyền chia sẻ và thu hồi; cho phép cấp lại quyền sau khi hết hạn / thu hồi.
- `PATCH /api/workspaces/:id/members/:userId`: chỉnh vai trò, giới hạn theo quyền chủ nhóm / quản trị.
- `DELETE /api/workspaces/:id/members/:userId`: xóa thành viên hoặc tự rời nhóm, bảo vệ chủ nhóm.
- Kiểm tra fingerprint và kích thước khóa công khai khi đăng ký khóa.
- Bổ sung bản ghi lịch sử đổi nhãn, xóa mềm, khôi phục, xóa vĩnh viễn và thu hồi chia sẻ.

## Hạn chế cần hiểu rõ
- Không hoàn thành toàn bộ các hạng mục Phần I–VIII. Chưa có streaming/chunk, worker, phiên bản `.pqf` chính thức, MFA, khôi phục mật khẩu, quản lý khóa xoay vòng, workspace file/folder permission, secure share link, quy trình email, chính sách RBAC production, fuzzing hoặc thẩm định bảo mật độc lập.
- Thu hồi chia sẻ ngăn truy cập ciphertext trên **máy chủ**, không thể xóa tệp người nhận đã tải/giải mã trước đó.
- Giao diện chỉ hiển thị nhãn tệp tổng quát được lưu trên máy chủ; tên gốc vẫn nằm trong ciphertext và chỉ lộ sau khi giải mã.
- Xóa vĩnh viễn là thao tác **không thể hoàn tác**. Việc xóa đồng thời S3/DB không thể đảm bảo atomic ở mức hệ phân tán: cần bổ sung retry/outbox trước khi triển khai production.
- Bản sao lưu nhập từ thiết bị chỉ mở trong phiên trình duyệt, **không** ghi đè bản sao khóa lưu trên máy chủ.
- Chưa chạy build đầy đủ khi tạo bản phát hành vì môi trường chỉnh sửa không tải được `npm` dependencies và không có Docker/DB; đã chạy kiểm tra cú pháp TypeScript cho tất cả các tệp TS và script Vue. Xem hướng dẫn kiểm thử bên dưới.

## Cách chạy trên máy phát triển

1. Cài Node.js >= 22 và Docker Compose.
2. Giữ **tệp `.env` riêng của bạn**, không đưa lên Git. Nếu chưa có, `cp .env.example .env`, cấu hình các biến mật khẩu và `PUBLIC_BASE_URL` tương ứng với địa chỉ bạn truy cập.
3. Chạy `docker compose up --build -d`; kiểm tra `docker compose ps` và `docker compose logs -f api web`.
4. Mở `http://localhost:8080` (trừ khi bạn chỉnh cổng proxy).
5. Nếu chạy trực tiếp: `npm install`, `npm run build`, `npm run test:crypto`. Server API yêu cầu PostgreSQL và S3-compatible storage.

## Checklist kiểm thử chấp nhận

- [ ] Đăng ký người dùng A, tạo và sao lưu bộ khóa, đăng xuất rồi đăng nhập / mở lại kho khóa.
- [ ] Tải lên 1 và 3 tệp; kiểm tra kết quả decrypt, filename gốc và đối chiếu nội dung.
- [ ] Tải 11 tệp hoặc một tệp >20 MiB, bảo đảm hiển thị cảnh báo hợp lý.
- [ ] Đổi nhãn, thử tìm kiếm, chuyển sang Thùng rác, khôi phục, xóa vĩnh viễn.
- [ ] Người dùng B tạo khóa; A chia sẻ cho B; B giải mã thành công.
- [ ] A thu hồi; B không còn tải ciphertext từ API; A cấp lại quyền cho B.
- [ ] Thử B truy cập/xóa/đổi nhãn tệp không sở hữu: phải bị từ chối.
- [ ] Tạo nhóm và thêm thành viên, chuyển vai trò và xóa; kiểm tra không ai có thể xóa OWNER.
- [ ] Nhập backup sai tài khoản / mật khẩu sai: không mở được kho khóa.
- [ ] Chạy `npm run build` và `npm run test:crypto`; thử giao diện cả desktop và mobile.
