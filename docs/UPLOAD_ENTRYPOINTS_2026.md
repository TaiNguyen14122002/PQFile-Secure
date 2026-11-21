# Điều hướng Tải lên & Mã hóa tệp (2026)

## Phạm vi thay đổi

- Trang chủ `/dashboard`: đặt nút **Tải lên & mã hóa tệp** dưới nhóm lợi ích của sản phẩm, để nút **Xem thống kê** ở bên phải điều khiển dashboard như trước.
- Trang **Tệp tin** `/files`: thêm nút **Tải lên & mã hóa tệp** luôn hiển thị ở đầu thư viện, với bố cục tự xuống dòng trên điện thoại, không bị ẩn khi có dữ liệu hoặc lọc tệp.
- Thanh điều hướng: bỏ nút tải lên riêng ở góc phải và menu di động để tránh trùng lặp. Trang `/upload` được xem là một phần của luồng Tệp tin khi tô sáng menu.
- Trang tải lên `/upload`: giữ nguyên xử lý mã hóa, bọc khóa, tải lên và tiến độ; sau khi thành công nút “Xem tệp vừa tải lên” mở `/files?tab=all` thay vì tab Được chia sẻ với tôi.

## Không thay đổi

- API, PostgreSQL, RustFS, thuật toán mật mã, dữ liệu nghiên cứu, seed và ảnh nền HD.
- Không tạo bộ mã hóa thứ hai trong các trang giới thiệu hoặc thư viện: mọi nút truy cập cùng luồng bảo vệ có sẵn tại `/upload`.

## Kiểm thử thủ công

1. Ở desktop, mở `/dashboard`: nút tải lên hiển thị bên trái dưới các nhãn; **Xem thống kê** vẫn mở/đóng đúng, không bị nút tải lên che.
2. Mở `/files` với tất cả, chia sẻ, đã chia sẻ và thùng rác: nút tải lên luôn nhìn thấy trong banner; nhấn đi đến `/upload`.
3. Ở màn hình điện thoại (dưới 740px), nút thư viện tự xuống dòng, không tràn ra ngoài; không còn nút tải lên trùng trong menu điều hướng.
4. Mã hóa và tải lên một tệp thử; sau thông báo thành công nhấn **Xem tệp vừa tải lên** để trở về tab Tất cả.
5. Truy cập `/upload`: menu **Tệp tin** hiển thị trạng thái đang chọn.

## Áp dụng

```sh
cd "/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure"
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Upload-CTA-Home-Files.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-Upload-CTA-Home-Files.patch"
docker compose up -d --build
```

Bản vá được thiết kế để áp dụng từ bản **Unified Home Background** và tương thích về nội dung với bản **HD Background** nếu đã áp dụng.
