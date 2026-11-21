# PQFile Secure – Sidebar trái và responsive toàn hệ thống (21/11/2026)

## Mục tiêu

Chuyển từ thanh điều hướng ngang sang **sidebar ở bên trái** để hỗ trợ nhiều mô-đun mới mà không làm chật topbar. Giữ nguyên chức năng hiện tại (10 tính năng bảo mật và AI, thư viện, mã hóa, chia sẻ, quản trị...). Không thêm API hoặc thay đổi dữ liệu.

## Giao diện và hành vi

- **Desktop/laptop từ 1024px**: sidebar bên trái, mặc định rộng 274px. Nút thu gọn chuyển về 76px (chỉ biểu tượng), nút mở rộng khôi phục nhãn. Trạng thái được lưu trong `localStorage` của trình duyệt với khóa `pqfile:sidebar-collapsed` (không gửi lên server).
- **Tablet/điện thoại dưới 1024px**: sidebar là menu trượt từ trái, mở bằng nút ba gạch trên topbar, đóng bằng X/lớp nền/Esc/chuyển trang. Tắt cuộn nền trong lúc menu đang mở; cố gắng giữ focus trong menu đối với phím Tab.
- **Chức năng được chia thành nhóm có thể mở/đóng**: Tổng quan, Tệp tin & Cộng tác, AI & An ninh, Hoạt động. Nhóm chứa trang đang được mở sẽ tự mở rộng khi điều hướng.
- **Hành động nhanh**: nút “Tải tệp mới” ở trên sidebar; topbar có tìm kiếm, cảnh báo an ninh, tài khoản. Cảnh báo chưa đọc hiển thị số (từ API cũ).
- **Trang đăng nhập/đăng ký**: không hiển thị sidebar.
- **Thư viện tệp**: dùng container queries để chuyển sang thẻ khi chính vùng danh sách bị hẹp do sidebar, không chỉ khi viewport nhỏ. Giữ nguyên thao tác và menu của từng tệp.
- **Dashboard**: lưới biểu đồ và thống kê giảm số cột ở laptop 1024–1580px. Các vùng nội dung dùng `min-width: 0`, tránh trang tràn ngang.
- **Modal**: hiển thị phủ trên cả sidebar khi mở (z-index), thay vì bị sidebar che.

### Các đường dẫn điều hướng

| Nhóm | Đường dẫn |
| --- | --- |
| Tổng quan | `/dashboard` |
| Tệp tin & cộng tác | `/files`, `/upload`, `/shared` (đi tới thư viện nhận), `/keys`, `/workspaces` |
| AI & an ninh | `/smart`, `/security`, `/governance` |
| Hoạt động | `/activity` |

### Thêm chức năng mới vào sidebar

Mở `apps/web/layouts/default.vue`, tìm mảng `navigation` ở đầu script. Thêm `{to:'/route',label:'Tên mô-đun',icon:TenIcon}` vào nhóm phù hợp, hoặc thêm cả nhóm `{key,title,items}`. Import biểu tượng Lucide tương ứng và tạo trang Nuxt dưới `apps/web/pages/`. Nếu thêm nhóm mới, khai báo trạng thái ban đầu trong `openGroups` để nhóm hiện mặc định. Không cần chỉnh CSS riêng cho từng liên kết.

## Những tệp thay đổi

- `apps/web/layouts/default.vue`: sidebar, điều hướng và topbar, xử lý focus/ESC, trạng thái thu gọn.
- `apps/web/assets/css/sidebar.css` (mới): giao diện sidebar, kích thước, mobile drawer và điều chỉnh vùng nội dung.
- `apps/web/assets/css/responsive.css` (giữ nguyên): các bố cục responsive của trang.
- `apps/web/pages/files.vue`: container queries cho vùng thư viện.
- `apps/web/nuxt.config.ts`: nạp stylesheet sidebar.

## Cách áp dụng (MacBook, có hoặc không có thư mục `.git`)

Đặt file `PQFile_Left_Sidebar_Responsive.patch` tại `/Volumes/Tai_Nguyen_256GB/NCKH/Source/`.
Mở Terminal **tại thư mục gốc** của mã nguồn `pqfile-secure` đã cập nhật 10 chức năng và responsive trước đó, rồi chạy:

```bash
PATCH="/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Left_Sidebar_Responsive.patch"
git apply --check "$PATCH"
git apply "$PATCH"
```

Không áp dụng lại PATCH nếu lệnh đầu báo lỗi; không bắt buộc chạy `git init`. Giữ lại `.env` hiện tại. Không cần migration vì chỉ cập nhật frontend.

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web
```

Kiểm tra tại http://localhost:8080. Trong DevTools thử viewport: 320×640, 390×844, 768×1024, 1024×768, 1280×800, 1440×900, 1680×1050 và 1920×1080. Thử mở/đóng menu, điều hướng các nhóm, thu gọn, tải lên, bảng/thẻ thư viện, modal xem trước/chia sẻ, cuộn ở màn hình thấp và zoom 200%.

## Giới hạn xác minh

Đã kiểm tra cú pháp TypeScript cho script của Vue, cấu trúc template layout, cú pháp CSS và áp dụng PATCH lên phiên bản mã nguồn gốc. Chưa chạy Nuxt build/Docker hoặc xác minh ảnh chụp trên trình duyệt với dữ liệu thật nếu thư viện chưa có trong môi trường tạo bản vá. Bổ sung kiểm thử thao tác và API trên thiết bị triển khai trước khi đưa vào sử dụng chính thức.
