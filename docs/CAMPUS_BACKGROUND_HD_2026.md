# PQFile Secure — Nền trường học HD toàn hệ thống

## Phạm vi cập nhật

- Ảnh nền chung mới: `apps/web/public/campus-background-hd.webp` (3.000 × 1.794 px; ~1,56 MB). Ảnh được tạo từ ảnh PNG trường học người dùng cung cấp, với Lanczos và tăng độ nét/độ tương phản nhẹ.
- Ảnh gốc chỉ có 1.172 × 701 px. Việc tăng kích thước cải thiện cách hiển thị trên màn hình lớn **nhưng không thể khôi phục chi tiết bị thiếu từ bản gốc**. Để có chi tiết thật vượt mức này, cần ảnh gốc có độ phân giải cao hơn.
- `assets/css/main.css`: chỉ một lớp ảnh `--pq-campus-image` ở lớp layout chung; lớp phủ sáng giảm độ đục, vẫn đảm bảo chữ/ô dữ liệu rõ. Bỏ làm mờ `backdrop-filter` phía sau các thẻ thống kê.
- `layouts/default.vue`: trang `/dashboard` dùng chính ảnh nền layout chung, nhưng lớp phủ xanh để tiêu đề màu trắng đủ tương phản.
- `assets/css/dashboard.css`: xóa background ảnh/vùng màu thứ hai của dashboard, giữ hiệu ứng mở/thu gọn thống kê và các thẻ thống kê.
- `pages/files.vue`, `components/HeroBanner.vue`, các banner tiêu đề/đăng nhập: cùng sử dụng ảnh HD; ảnh cũ vẫn còn để dự phòng.
- `nuxt.config.ts`: khai báo preload ảnh dùng toàn hệ thống, tránh hiện ảnh nền muộn khi mở trang.
- **Không đụng tới API, PostgreSQL, RustFS, dữ liệu demo hay mã hóa.**

## Áp dụng bản vá trên MacBook

Tải `PQFile-Secure-HD-Background-2026.patch` vào `/Volumes/Tai_Nguyen_256GB/NCKH/Source`, sau đó chạy:

```bash
cd '/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure'
git status --short
git apply --check '/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-HD-Background-2026.patch'
git apply '/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile-Secure-HD-Background-2026.patch'
docker compose up -d --build
```

Lưu ý: chỉ chạy `git apply` khi bước `--check` không báo lỗi; sao lưu hoặc commit thay đổi có sẵn trước đó. Bản vá này được tạo trên **PQFile-Secure-Unified-Home-Background-Source.zip**.

## Kiểm tra giao diện

1. Truy cập `/dashboard` và `/files`, sau đó `/shared`, `/keys`, `/workspaces`, `/activity`.
2. Xem tại 1680 × 1050, 1920 × 1080 và kích thước điện thoại; kiểm tra ảnh trường và chữ ở trên nền.
3. Tại `/dashboard`, bấm **Xem thống kê** rồi **Thu gọn**; ảnh nền phải liên tục, không lặp/đổi màu khi mở thống kê.
4. Nếu vẫn nhìn thấy ảnh cũ, tải lại mạnh bằng `Cmd + Shift + R` hoặc thử cửa sổ ẩn danh; tên tệp mới `campus-background-hd.webp` giúp tránh cache ảnh cũ.
5. Kiểm tra tab Network: `GET /campus-background-hd.webp` phải trả HTTP 200, `Content-Type: image/webp`.

## Tạo lại ảnh HD khi có ảnh gốc chất lượng cao hơn

Chỉ khi muốn thay ảnh nền mới, có thể chạy script ngoại tuyến (không yêu cầu cấu hình Node hay Docker):

```bash
python3 -m pip install Pillow
python3 scripts/build-campus-background.py '/path/to/anh-goc.png'
```

Ảnh WebP đầu ra được đặt ở `apps/web/public/campus-background-hd.webp`.
