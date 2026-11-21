# PQFile Secure — Đợt hoàn thiện giao diện và nghiệp vụ (11/2026)

## Phiên bản làm nền và phạm vi

Bản vá **PQFile-Secure-Polish-2026.patch** được tạo từ gói `PQFile-Secure-Research-Database-Background-Source.zip` đã giao trước đó. Bản nền đã chứa Home Dashboard, Shared Library, ảnh trường học và công cụ seed vào PostgreSQL/RustFS. Áp dụng bản vá này **sau** bản Research-Database-Background, không trực tiếp lên bản 0.1.0 hoặc một nhánh đã thay đổi khác nếu chưa kiểm tra xung đột.

Tập trung vào những chỗ có ảnh hưởng chức năng: tìm kiếm/lọc lịch sử đầy đủ trên cơ sở dữ liệu; quản lý nhóm và phân quyền thực; chia sẻ lại tệp đã bị thu hồi/hết hạn; tối ưu tải danh sách tệp lớn; thống nhất thiết kế và trải nghiệm. Không gỡ bỏ tính năng mã hóa ở `/upload`, cũng không chạy seed tự động.

## Những thay đổi cụ thể

| Khu vực | Đã chỉnh sửa |
| --- | --- |
| **Giao diện chung** | Header điều hướng desktop/mobile, liên kết bỏ qua menu, trạng thái trang đang mở, trang đăng nhập/đăng ký, PageHeading dùng chung, các thẻ/nút/trạng thái trống, lớp phủ màu trên ảnh trường, hỗ trợ màn hình nhỏ. |
| **Trang chủ** | Dùng ảnh trường đã cung cấp, mô tả ba đặc tính kỹ thuật thay cho tuyên bố an toàn tuyệt đối. Giữ biểu đồ thống kê cá nhân. |
| **Tệp tin** | `/files/library` trả bản tóm tắt nhẹ, bỏ chữ ký, envelope, manifest khỏi danh sách hàng loạt; API `/files/:id` lấy dữ liệu giải mã cho tệp được chọn. Giữ xem PDF/ảnh/văn bản cục bộ, tải về, khôi phục, đổi nhãn, chia sẻ và bộ lọc. Bổ sung chọn tệp bằng bàn phím và xóa bộ lọc rỗng. |
| **Chia sẻ** | `/shared` chuyển tới `/files?tab=received` để không tồn tại hai màn hình chia sẻ tách rời, tránh sai lệch chức năng. Trên backend, cấp lại quyền đã thu hồi/hết hạn sẽ cập nhật hoặc tái tạo recipient envelope đúng bản ghi; xác thực hạn chia sẻ và trạng thái tài khoản người nhận; thu hồi không tạo sự kiện giả khi không có quyền. |
| **Khóa mật mã** | Đầu trang thống nhất, nút chuyển tới tải lên, sao chép fingerprint, cảnh báo thiếu khóa chữ ký đang hoạt động. Không thay cơ chế bí mật trong RAM hay bản sao lưu Argon2id. |
| **Nhóm làm việc** | Tạo/đổi tên/xóa nhóm; thêm/xóa thành viên, đổi vai trò; chỉ chủ nhóm đổi tên/xóa và cấp quyền ADMIN; kiểm tra thành viên trùng; ghi nhật ký thay đổi. Xóa nhóm không xóa tài khoản hoặc ciphertext của thành viên. |
| **Lịch sử** | API `/activity/paged` tìm theo mã thao tác hoặc tên tệp, lọc loại thao tác và khoảng ngày **trước** khi phân trang; sắp xếp ổn định. UI đồng bộ bộ lọc, làm mới, phân trang và xuất CSV **chỉ trang đang xem**. CSV được xử lý hạn chế nguy cơ spreadsheet-formula injection. |
| **Tải lên** | Tiến độ đã hoàn thành / tổng số tệp và phần trăm theo lượt; giữ cơ chế mã hóa trên trình duyệt và giữ lại tệp lỗi để thử lại. |
| **Kiểm thử** | Thêm `scripts/smoke-refinement.sh` kiểm tra trang sức khỏe và từ chối truy cập trái phép, không cần seed. |

## Cách triển khai MacBook

Đường dẫn người dùng:

- Mã nguồn: `/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure`
- Bản vá: `/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Polish-2026.patch`

```bash
cd "/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure"
git status --short
# Commit hoặc sao lưu những thay đổi đang có trước khi áp dụng.
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Polish-2026.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Polish-2026.patch"
docker compose up -d --build
docker compose ps
bash scripts/smoke-refinement.sh
```

**Không chạy** `docker compose down -v`, không xóa volumes. Bản vá không tự chạm vào PostgreSQL hay kho ciphertext. Dữ liệu đã seed được giữ nguyên. Nếu chưa nạp dữ liệu nghiên cứu, chỉ chạy `bash scripts/seed-research-macos.sh` sau khi đã sao lưu DB và xác nhận đang dùng môi trường nghiên cứu riêng, theo tài liệu seed cũ.

## Kiểm thử nghiệp vụ sau khi build

1. Đăng nhập tài khoản đã seed (ví dụ `demo.admin@pqfile.local`, mật khẩu là mật khẩu bạn đã thiết lập), vào Dashboard và kiểm tra biểu đồ tương ứng với dữ liệu **của tài khoản**, không phải tổng toàn hệ thống.
2. Vào Khóa mật mã, mở bằng mật khẩu kho khóa nghiên cứu đã thiết lập. Sao chép fingerprint. Không tạo/đổi khóa mới để tránh mất khả năng giải mã.
3. Tại Tệp tin, mở tab Được chia sẻ; tìm một tệp PDF, bấm Xem trước rồi Tải xuống. Kiểm tra giải mã và chữ ký; thử chuyển bộ lọc, phân trang và quay lại.
4. Chọn tệp do tài khoản sở hữu; cấp quyền cho một tài khoản có khóa công khai; ở máy/tài khoản nhận, giải mã tệp. Thu hồi, xác nhận người nhận không thể tải lại từ máy chủ. Cấp lại cùng người nhận và xác nhận đọc được tệp trở lại.
5. Tạo một nhóm thử, thêm tài khoản khác, kiểm tra không thể thêm trùng; đổi vai trò, đổi tên nhóm và rời nhóm bằng tài khoản không phải OWNER. Chỉ OWNER được xóa/đổi tên nhóm. Nhóm không cấp quyền tệp tự động.
6. Vào Lịch sử; lọc `WORKSPACE_CREATE`, tìm tên tệp, chuyển trang. Tệp CSV xuất ra phải chứa đúng dữ liệu trang hiện tại, không phải toàn bộ kết quả.
7. Trên điện thoại hoặc DevTools kích thước 375–430 px, kiểm tra menu, biểu mẫu, bảng tệp có cuộn ngang và trình xem tệp dưới danh sách.
8. Tạo một tệp nhỏ ở `/upload`, mã hóa/tải lên, kiểm tra tiến độ và xuất hiện trong `/files`; thử chọn nhiều tệp, trường hợp lỗi một phần không mất danh sách chưa tải.

## Giới hạn quan trọng

- **Chưa được xác thực build hoặc kiểm thử tích hợp bằng Docker/PostgreSQL/RustFS trong môi trường biên soạn**, vì không có Docker và registry npm không thể truy cập. Kiểm tra cú pháp TypeScript, CSS, cân bằng thẻ Vue và tính áp dụng bản vá không thay thế cho `docker compose up --build` thực tế.
- Việc thống kê metadata không chứng minh tệp an toàn hoặc chữ ký hợp lệ cho đến khi ứng dụng giải mã và xác minh.
- Quyền trong **Nhóm làm việc** hiện dành cho thành viên; chưa có ACL chia sẻ tệp tự động theo nhóm, phân quyền thư mục hoặc mời qua email.
- Chưa triển khai xoay khóa ML-KEM/ML-DSA kèm tái bọc CEK cho tất cả tệp; mất khóa bí mật hoặc mật khẩu kho khóa có thể khiến dữ liệu không giải mã được.
- Chưa có trình xem trước Office tích hợp, PDF vẫn dùng trình xem của trình duyệt và không có số trang đáng tin cậy.
- Thu hồi chia sẻ chỉ ngăn truy cập ciphertext từ máy chủ trong tương lai, không thu hồi được bản rõ đã tải về trước đó.
- Những bước bảo mật production, kiểm toán độc lập, backup/restore tự động và kiểm thử end-to-end cần thực hiện riêng trước khi đưa dữ liệu người dùng thật lên môi trường công khai.
