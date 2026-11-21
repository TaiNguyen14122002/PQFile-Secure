# TÀI KHOẢN DEMO ĐẦY ĐỦ – PQFILE SECURE

## Mục tiêu

Tạo một tài khoản thử nghiệm mới, không ghi đè tài khoản `demo.admin@pqfile.local` và không thay đổi các dữ liệu V1/V2 hiện có. Dữ liệu là **mô phỏng/synthetic**, không phải tài liệu, sự kiện hay cá nhân thật. Một số mục ghi hoạt động / cảnh báo là kịch bản tạo sẵn và có `syntheticDataset` hoặc dấu `(mô phỏng)`.

- Email tài khoản: **`demo.showcase@pqfile.local`**.
- Mật khẩu đăng nhập / kho khóa: hai chuỗi ngẫu nhiên riêng biệt trong macOS Keychain; **không có mật khẩu mặc định**.
- Quyền: `USER` — không tự cấp quyền quản trị toàn hệ thống.
- Bộ dữ liệu có tên: `pqfile-showcase-account-2026-v1`.

## Phân bổ dữ liệu

| Thành phần | Số lượng nạp | Hiển thị / lưu ý |
|---|---:|---|
| Tài liệu mã hóa | 120 | 96 tài liệu thuộc demo, 24 tài liệu của các tài khoản V1 chia sẻ tới demo |
| Tài liệu thuộc demo | 96 | 84 còn hoạt động, 12 ở Thùng rác |
| Quyền chia sẻ | 66 | 42 chiều đi, 24 chiều đến; một số đã thu hồi hoặc hết hạn |
| Nhóm làm việc | 6 | Demo làm chủ nhóm; có thành viên là tài khoản nghiên cứu V1 |
| Nhật ký hoạt động | 253 | Các sự kiện mô phỏng có nhãn rõ ràng |
| Sự kiện an ninh | 36 | Các mức điểm rủi ro, gồm cảnh báo và sự kiện bình thường |
| Định dạng tệp | 8 | PDF, DOCX, XLSX, TXT, CSV, JSON, PNG, ZIP |

Lưu ý: trang Dashboard và Thư viện chỉ đếm tài liệu đang hoạt động mà tài khoản có quyền xem. Không phải tất cả 120 tệp đều hiển thị cùng lúc, bởi 12 tệp nằm ở Thùng rác và một số quyền nhận đã hết hạn hoặc bị thu hồi.

## Cách cài đặt trên MacBook

1. Đặt bản PATCH `PQFile_Demo_Showcase_Account.patch` trong `/Volumes/Tai_Nguyen_256GB/NCKH/Source`.
2. Mở Terminal, `cd` đến thư mục gốc của **dự án hiện tại** (`pqfile-secure`).
3. Sao lưu PostgreSQL và kho ciphertext hiện tại; dùng môi trường nghiên cứu **riêng biệt**.
4. Chạy:

   ```bash
   git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Demo_Showcase_Account.patch"
   git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Demo_Showcase_Account.patch"
   docker compose up -d --build api
   bash scripts/seed-showcase-macos.sh
   ```

   Nhập chính xác `SHOWCASE` khi được hỏi để xác nhận.

5. Lấy thông tin đăng nhập **trên Terminal của bạn**, không chia sẻ mật khẩu:

   ```bash
   bash scripts/show-showcase-credentials-macos.sh
   ```

   Nhập `SHOW` nếu bạn đang ở nơi riêng tư.

6. Đăng nhập trên `http://localhost:8080/login` bằng `demo.showcase@pqfile.local` cùng mật khẩu đăng nhập vừa xem. Khi mở khóa tệp, sử dụng **mật khẩu kho khóa riêng của tài khoản showcase**.

## Kiểm tra dữ liệu sau khi seed

Các lệnh đọc-only dưới đây dùng đúng tên Docker Compose của dự án:

```bash
# Bộ dữ liệu đã hoàn tất?
docker compose exec -T postgres psql -U pqfile -d pqfile -c \
  "SELECT dataset_id,file_count,share_count FROM research_seed_runs WHERE dataset_id='pqfile-showcase-account-2026-v1';"

# Tài liệu của tài khoản showcase
 docker compose exec -T postgres psql -U pqfile -d pqfile -c \
  "SELECT u.email,f.status,count(*) AS tong FROM files f JOIN users u ON u.id=f.owner_id WHERE u.email='demo.showcase@pqfile.local' GROUP BY u.email,f.status ORDER BY f.status;"

# Sự kiện an ninh của tài khoản
 docker compose exec -T postgres psql -U pqfile -d pqfile -c \
  "SELECT count(*) AS tong_canh_bao FROM security_events e JOIN users u ON u.id=e.user_id WHERE u.email='demo.showcase@pqfile.local';"
```

Các trang kiểm tra: `/dashboard`, `/files?tab=all`, `/files?tab=received`, `/files?tab=sent`, `/workspaces`, `/governance`, `/security`, `/activity`, `/smart`.

## An toàn, bí mật và khả năng chạy lại

- Chương trình không vô hiệu hóa xác thực, mật mã hay phân quyền. Tệp lưu vào kho S3-compatible bằng AES-GCM và phong bì ML-KEM; khóa riêng lưu trong bản sao kho khóa đã mã hóa.
- Mật khẩu được tạo riêng; không sử dụng lại mật khẩu đã xuất hiện trong cuộc trò chuyện hay mật khẩu của tài khoản demo V1.
- Chỉ một tài khoản showcase mới được thêm; các tài khoản nghiên cứu V1 có sẵn được dùng làm bên gửi/nhận, không sinh thêm tài khoản mới cho họ.
- Cần **đã nạp V1** để mở khóa các tài khoản nghiên cứu nguồn, tạo tệp chia sẻ đến và mã hóa cho người nhận. Không sửa mật khẩu V1.
- Nếu chạy lại sau khi hoàn tất, `research_seed_runs` giúp bỏ qua nạp lại; nếu chạy dở, các ID cố định và `ON CONFLICT` tránh tạo lại dữ liệu đã ghi. Tránh chạy đồng thời hai lượt seed.
- Không chạy trên production hoặc máy có dữ liệu thật. Sao lưu trước khi nạp. Chỉ ghi kịch bản nhật ký mô phỏng vào môi trường nghiên cứu.
- Xóa tài khoản hoặc đổi mật khẩu kho khóa mà không tái mã hóa bản sao khóa có thể khiến không giải mã được tài liệu; không sửa thủ công các bản ghi khóa.
- Giới hạn: chưa chạy kiểm thử end-to-end với Docker/PostgreSQL/RustFS trên máy người dùng. Các kiểm thử cục bộ xác nhận cấu trúc dữ liệu và định dạng tệp, không thay thế chạy thử trên hệ thống thực.
