# PQFile Secure — Đồng bộ nền theo Thư viện tệp

## Mục tiêu

Tất cả các trang PQFile Secure dùng cùng nền màu **#f4f7fc** đang được định nghĩa tại `.file-portal` trên trang Thư viện tệp (`apps/web/pages/files.vue`).

## Phạm vi

- Toàn bộ vùng bao ứng dụng và nền các trang Dashboard, Tải lên, Kho khóa, Nhóm làm việc, Tìm kiếm và Tóm tắt, An ninh, Quản trị quyền, Nhật ký hoạt động, Đăng nhập/Đăng ký dùng nền trung tính #f4f7fc.
- Không dùng ảnh khuôn viên và lớp phủ xanh cho nền **toàn màn hình** nữa. Các ảnh trong banner/hero riêng vẫn được giữ nguyên.
- Giữ header cố định, sidebar trái, kiểu thẻ, bảng, biểu mẫu và chế độ chỉ cuộn danh sách của trang `/files`.
- **Không thay đổi** các file Vue, API, database, dữ liệu Demo, mật mã, hoặc cấu hình truy cập.

## Những tệp thay đổi

- `apps/web/assets/css/main.css`: khai báo `--pq-workspace-background:#f4f7fc`, áp dụng cho body và `.pq-app-shell`, loại bỏ hai pseudo-element nền ảnh/lớp phủ toàn ứng dụng; giữ nội dung trang trên nền trong suốt.

## Áp dụng trên macOS

Từ thư mục gốc `pqfile-secure`:

```sh
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Unified_Library_Background_2026.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Unified_Library_Background_2026.patch"
docker compose up -d --build web
```

**Chỉ chạy `git apply` sau khi lệnh `--check` không có lỗi.** Thư mục không có `.git` vẫn có thể sử dụng `git apply` như các bản vá trước.

Làm mới trình duyệt bằng **Command + Shift + R**. Kiểm tra `/dashboard`, `/upload`, `/workspaces`, `/smart`, `/security`, `/governance`, `/activity` và `/files` trên desktop và điện thoại.

## Giới hạn kiểm thử

Đã kiểm tra cấu trúc CSS, màu nền tính toán bằng Chromium trong bố cục đại diện và khả năng áp dụng PATCH từ bản nguồn sau cập nhật Compact Operations. Chưa chạy bản build Docker/Nuxt trên MacBook của người dùng.
