# PQFile Secure — Bản tối ưu mật độ giao diện & Responsive 2026

## Phạm vi

Bản vá được tạo từ **PQFile Secure — Library Light Style Corrected 2026** (phiên bản đã đồng bộ tiêu đề nền sáng). Bố cục mới tận dụng diện tích nội dung thực tế sau khi trừ sidebar, giảm chiều cao các khối quá lớn và ưu tiên các cột cân đối:

| Trang | Điều chỉnh |
|---|---|
| Dashboard | Thu gọn hero, thẻ thống kê, biểu đồ; chia lưới biểu đồ theo độ rộng |
| Tải lên & mã hóa | Kéo thả và tùy chọn bảo mật song song khi có đủ chiều rộng; vùng kéo thả bớt cao |
| Kho khóa | Các khung quản lý khóa và fingerprint song song trên laptop đủ rộng |
| Nhóm làm việc | Danh sách nhóm chiếm khoảng 30%; tăng chỗ cho phần thành viên |
| Tìm kiếm & Tóm tắt | Cân đối tra cứu và quản lý chỉ mục theo hai cột khi đủ không gian |
| Giám sát an ninh | Thu nhỏ KPI, bộ lọc và hiển thị cảnh báo hai cột khi vùng nội dung đủ rộng |
| Quản trị quyền | Giảm khoảng cách, thẻ quyền hai cột khi đủ chỗ |
| Nhật ký hoạt động | Thẻ nhật ký hai cột khi đủ chỗ, giữ phân trang |
| Đăng nhập / Đăng ký | Thu gọn khối giới thiệu, giảm khoảng trống dọc |

**Không thay đổi** `apps/web/pages/files.vue`, CSS sidebar, header, cơ chế cuộn riêng trong Thư viện tệp, API, PostgreSQL, dữ liệu demo hoặc mật mã. Bản vá chỉ thêm một tệp CSS và một class vào các trang còn lại.

## Áp dụng trên MacBook

1. Tải `PQFile_Adaptive_Dense_UI_2026.patch` và lưu đúng tên ở `/Volumes/Tai_Nguyen_256GB/NCKH/Source`.
2. Mở Terminal tại thư mục gốc `pqfile-secure` (có `docker-compose.yml`).
3. Chạy:

```bash
PATCH="/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Adaptive_Dense_UI_2026.patch"
ls -lh "$PATCH"
git apply --check "$PATCH"
git apply "$PATCH"
docker compose up -d --build web
```

Chỉ chạy `git apply` khi lệnh `--check` không báo lỗi. `git apply` có thể áp dụng ngoài Git repository, do đó lỗi `git status: not a git repository` không cho biết PATCH có thành công hay không.

Sau đó mở `http://localhost:8080` và nhấn `Command + Shift + R`. Nếu bước kiểm tra báo `patch does not apply`, **không áp dụng cưỡng bức**, vì cấu trúc mã nguồn thực tế có thể khác phiên bản dùng để tạo bản vá.

## Kiểm tra sau khi triển khai

- Desktop 1440px, sidebar mở: các danh sách nghiệp vụ và khung quản lý dùng 2 cột nếu đủ không gian.
- Laptop 1280px: các trang công cụ chuyển cột theo chiều rộng còn lại, không theo chiều rộng toàn trình duyệt.
- Tablet 768px: ưu tiên một cột với biểu mẫu không tràn ngang.
- Điện thoại 320–390px: tiêu đề gọn, bộ lọc xếp dọc, các nút vẫn có diện tích chạm phù hợp.
- `/files?tab=all`: giao diện đã duyệt giữ nguyên, chỉ danh sách tài liệu cuộn độc lập như trước.

## Kiểm thử đã thực hiện

- Kiểm tra tính hợp lệ cú pháp CSS: đạt.
- 64 trường hợp trình duyệt Chromium mô phỏng trên 8 trang × 8 độ rộng (320, 360, 390, 768, 1024, 1280, 1440, 1920px): không phát hiện tràn ngang trong mô hình kiểm tra.
- Thử `git apply --check` và `git apply` trên bản nguồn sạch tương ứng: đạt.
- Đối chiếu lại 12 tệp được thêm/sửa và xác nhận giao diện Thư viện tệp không bị thay đổi.
- Tính toàn vẹn file ZIP: đạt.

**Giới hạn:** Các bài kiểm thử trình duyệt sử dụng bố cục mô phỏng có tải CSS thực tế, không phải bản build Nuxt chạy với dữ liệu và API. Chưa kiểm chứng `npm run build`/Docker tích hợp trên MacBook của bạn; cần kiểm tra sau khi áp dụng.
