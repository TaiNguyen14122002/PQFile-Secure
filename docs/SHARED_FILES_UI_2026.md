# PQFile Secure — giao diện thư viện tệp & chia sẻ

Bản cập nhật cho **v0.2.0**, sử dụng ảnh mẫu giao diện người dùng cung cấp ngày 21/11/2026.

## Phạm vi

- Thay `apps/web/pages/files.vue` bằng giao diện nền xanh, banner trường học sẵn có, thanh chọn Tất cả / Được chia sẻ với tôi / Tôi đã chia sẻ / Thùng rác, bộ lọc và bảng có phân trang.
- Thêm `GET /api/files/library` tại `apps/api/src/files/files.controller.ts`. API này chỉ trả về tệp mà phiên hiện tại có quyền, chỉ đếm chia sẻ **chưa thu hồi/chưa hết hạn**, và bổ sung tên chủ sở hữu, ngày chia sẻ, quyền được cấp (`FILE_DOWNLOAD`), số người nhận còn hiệu lực.
- Các nút thực hiện tải xuống/giải mã tại máy khách, xem trước tài liệu, đổi nhãn, quản lý người nhận, cấp quyền/thu hồi, xóa mềm, khôi phục, xóa vĩnh viễn.
- Xem trước sau khi chủ động mở kho khóa và bấm Xem trước. PDF dùng bộ xem PDF tích hợp của trình duyệt; ảnh và văn bản phổ biến được hỗ trợ. Office/ZIP được thông báo chưa hỗ trợ, vẫn cho phép tải bản giải mã.
- Tệp bản rõ không được gửi đến API. Nội dung xem trước chỉ tồn tại trong bộ nhớ của trình duyệt; URL tạm được thu hồi khi đóng hoặc chuyển tệp. Việc kiểm tra toàn vẹn và chữ ký sử dụng `decryptFile` có sẵn.

## Không hiển thị dữ liệu giả

Số lượng tệp / thời gian / quyền / tên người chia sẻ đều lấy từ API. Với tệp tải lên mặc định không mang phần mở rộng trong `displayLabel`, bộ lọc loại tệp có thể phân loại là **Khác** vì không giải mã toàn bộ thư viện để đoán loại. Không hiển thị chế độ "Có thể chỉnh sửa" vì backend hiện chỉ hỗ trợ quyền `FILE_DOWNLOAD`.

## Triển khai

```bash
cd "/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure"
git status --short
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Shared-Library-UI.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Shared-Library-UI.patch"
docker compose up -d --build
```

Mở `http://localhost:8080/files` và đăng nhập. Mặc định chọn tab **Được chia sẻ với tôi**, giống ảnh mẫu. Có thể truy cập `/files?tab=all`, `/files?tab=sent`, `/files?tab=trash` khi tải trang.

## Những điều cần kiểm thử trên máy cục bộ

1. Nhận tệp từ tài khoản khác, xem metadata đúng chủ sở hữu, không xem được tệp đã thu hồi/hết hạn.
2. Đăng nhập, mở kho khóa, xem trước và tải PDF/PNG/TXT trên thiết bị; thử khóa sai hoặc chữ ký bị sai.
3. Tài khoản chủ sở hữu: chia sẻ / thu hồi / đổi nhãn / chuyển thùng rác / khôi phục / xóa vĩnh viễn.
4. Các tab, tìm kiếm, lọc ngày, lọc loại, sắp xếp và phân trang với >5 tệp.
5. Desktop 1680×1050, tablet và mobile.

Lưu ý: nút chuyển trang/thu phóng PDF điều khiển tham số `#page` và `#zoom` trong PDF viewer gốc của trình duyệt. Khả năng hỗ trợ phụ thuộc trình duyệt, không có tổng số trang từ API. Để có toolbar PDF độc lập và chính xác trên mọi trình duyệt cần tích hợp thư viện render PDF trong lần nâng cấp tiếp theo.
