# PQFile Secure — Responsive toàn hệ thống (bản 10 chức năng)

## Phạm vi thay đổi

- **Thanh điều hướng**: Giữ menu đầy đủ từ màn hình rất rộng (2XL, >=1536px). Từ 1535px trở xuống chuyển thành menu điều hướng mở/đóng, có lớp nền để bấm đóng, hỗ trợ phím Esc, tự đóng sau khi chuyển trang. Menu hỗ trợ cuộn riêng khi màn hình thấp.
- **Toàn bộ trang**: Nội dung thích ứng với chiều rộng 320px, 360px, 375px, 390px, 430px, 768px, 1024px, 1280px, 1440px, 1680px và 1920px trở lên. Khoảng cách, card, tiêu đề, nút và modal co giãn theo viewport. Không dùng `overflow-x:hidden` toàn cục để che lỗi.
- **Thư viện tệp (`/files`)**: Từ 740px trở xuống dùng thẻ hiển thị tên, dung lượng, người chia sẻ, thời điểm, quyền và các thao tác cần thiết (xem chi tiết, xem trước, tải xuống, đổi nhãn, quản lý chia sẻ, xóa hoặc khôi phục). Bảng máy tính vẫn giữ nguyên ở màn hình lớn.
- **Tải lên (`/upload`)**: Xếp phần quét tệp và cấu hình mã hóa thành 1 cột trên tablet/điện thoại; vùng chọn tệp, bộ chọn thuật toán và bảng đo hiệu năng co giãn.
- **Quản trị quyền (`/governance`)**: Có nút phóng to/thu nhỏ bản đồ SVG (60–140%), cuộn ngang/dọc tại vùng sơ đồ; danh sách rà soát, ngày hết hạn và nút thao tác xuống dòng khi cần.
- **Khóa (`/keys`), nhóm (`/workspaces`), lịch sử (`/activity`), an ninh (`/security`), tìm kiếm (`/smart`)**: Bố cục một cột ở màn hình hẹp, hạn chế tràn nội dung và tăng diện tích chạm.
- **Đăng nhập/Đăng ký (`/login`, `/register`)**: Khu vực giới thiệu thu gọn và biểu mẫu co giãn trên điện thoại.
- **Bảng điều khiển (`/dashboard`)**: Tự xếp lại biểu đồ, thống kê và thẻ hoạt động theo kích thước màn hình.
- **Dialog/Modal**: Giới hạn chiều cao theo `dvh`, cuộn nội dung riêng khi màn hình thấp; có hỗ trợ `safe-area-inset`.

## Cách áp dụng PATCH (macOS, thư mục dự án không có .git vẫn dùng được)

Đặt file `PQFile_Responsive_All_Screens.patch` trong:

`/Volumes/Tai_Nguyen_256GB/NCKH/Source/`

Mở Terminal trong đúng thư mục `pqfile-secure`, tại nơi có `apps/` và `docker-compose.yml`:

```bash
pwd
ls apps/web/pages/files.vue docker-compose.yml
PATCH="/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Responsive_All_Screens.patch"
git apply --check "$PATCH"
git apply "$PATCH"
```

Nếu `git apply --check` báo lỗi, **dừng lại** để đối chiếu phiên bản, không cố áp dụng lại hoặc dùng `--reject`.

Vì bản này chỉ chỉnh giao diện phía web, không có migration cơ sở dữ liệu. Sau khi sao lưu cấu hình và dữ liệu quan trọng nếu cần, chạy:

```bash
docker compose up -d --build
# kiểm tra trạng thái
 docker compose ps
 docker compose logs --tail=100 web
```

**Lưu ý:** `git status` chỉ chạy được nếu thư mục là Git repository. `git apply` dùng được cả khi thư mục không có `.git`.

## Thử nghiệm bằng DevTools

Chrome / Edge / Safari: mở trang, bật chế độ Device Toolbar, thử lần lượt các kích thước:

| Kích thước tham khảo | Phạm vi kiểm tra |
|---|---|
| 320 × 640 | Điện thoại nhỏ: menu 1 cột, bảng tệp thành thẻ, nút không bị cắt |
| 375 × 812, 390 × 844 | iPhone: biểu mẫu, chọn tệp, dialog, xem trước, thao tác chia sẻ |
| 430 × 932 | Điện thoại lớn: menu 2 cột, tiêu đề và thẻ thống kê |
| 768 × 1024 | Tablet dọc: navigation overlay, trang nhóm và màn hình khóa |
| 1024 × 768 | Tablet ngang: bảng thư viện, biểu đồ, tìm kiếm AI |
| 1280 × 800, 1440 × 900 | Laptop: không chồng nút menu; biểu mẫu không tràn |
| 1680 × 1050, 1920 × 1080 | Desktop: lưới nhiều cột, căn khoảng trắng, sơ đồ quyền |

Cần thử cả trường hợp **tên tệp dài**, **email dài**, **nhiều quyền truy cập**, **modal chia sẻ**, **menu mở ở cuối trang**, và **zoom trình duyệt 200%**. Kiểm tra không có thanh cuộn ngang ngoài ý muốn trên `body`; vùng sơ đồ hoặc bảng hiệu năng có thể cuộn ngang riêng.

## Giới hạn xác minh

Đã kiểm tra cú pháp stylesheet, cú pháp `<script setup>` và cấu trúc thẻ template bằng công cụ tĩnh. Chưa chạy build Nuxt, hệ thống Docker hoặc test trực quan trên trình duyệt với ứng dụng thật trong môi trường tạo bản vá vì không tải được dependencies npm. Hãy chạy kiểm thử giao diện và chức năng trên máy Mac trước khi sử dụng chính thức.
