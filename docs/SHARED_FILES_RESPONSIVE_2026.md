# PQFile Secure — Cập nhật giao diện thư viện chia sẻ (21/11/2026)

## Mục tiêu

Cải thiện giao diện `/files`, đặc biệt tab **Được chia sẻ với tôi**, đồng thời áp dụng nhất quán cho **Tất cả tệp**, **Tôi đã chia sẻ** và **Thùng rác**. Bản cập nhật chỉ thay đổi Vue/CSS frontend; không thay đổi API, mã hóa, chữ ký, dữ liệu hay quy tắc phân quyền.

## Giao diện mới

- Nền trang sáng, bỏ hình trường học ở phía sau danh sách, giúp thông tin dễ đọc.
- Banner gọn hơn, phân cấp rõ tiêu đề và nút tải lên.
- Hiển thị toàn bộ danh sách dưới dạng thẻ, tránh cột thao tác bị cắt do sidebar chiếm chiều rộng.
- Bộ lọc tìm kiếm, thời gian, loại tệp, sắp xếp được co giãn theo màn hình.
- Khung xem trước có toolbar, tab thông tin, nút tải xuống và chế độ toàn màn hình dễ nhận biết hơn.
- Từ **1430px trở xuống**, chi tiết/xem trước mở dạng ngăn trượt (drawer) phủ bên phải; nhấn nút ×, nhấn vùng tối hoặc Esc để đóng.
- Từ **1431px trở lên**, danh sách nằm bên trái và khung xem trước dính theo vùng xem ở bên phải.
- Không thay đổi cách xác minh chữ ký ML-DSA trước khi giải mã, cũng không thay đổi Markdown Reader, PDF/DOCX/XLSX/PPTX Viewer.

## Cách áp dụng (macOS, mã nguồn tại ổ đĩa ngoài)

Tải PATCH `PQFile_Shared_Files_UI_Responsive_2026.patch` vào:

`/Volumes/Tai_Nguyen_256GB/NCKH/Source`

Trong Terminal, chuyển vào thư mục gốc `pqfile-secure`, rồi chạy:

```bash
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Shared_Files_UI_Responsive_2026.patch"
```

Nếu không có lỗi thì chạy:

```bash
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Shared_Files_UI_Responsive_2026.patch"
docker compose up -d --build web
```

Mở `/files?tab=received`, nhấn **Command + Shift + R** nếu trình duyệt còn lưu CSS cũ.

### Nếu không áp dụng được

- Đảm bảo đã áp dụng **PATCH xem trước đa định dạng & Markdown Reader** trước đó.
- Không áp dụng bản cập nhật này hai lần.
- Nếu có thông báo `patch does not apply`, giữ nguyên mã nguồn và gửi thông báo lỗi để đối chiếu. Không dùng `git apply --reject` khi chưa kiểm tra xung đột.
- Thư mục không bắt buộc phải có `.git` để chạy `git apply`.

## Cách tự kiểm tra

1. Trên desktop lớn: có danh sách thẻ bên trái và khung xem trước bên phải.
2. Trên laptop: chọn tệp rồi mở drawer chi tiết và kiểm tra nút đóng.
3. Trên điện thoại: tab chia hai hàng; bộ lọc không gây tràn ngang; thao tác đủ lớn để chạm.
4. Thử một file `.md` ở chế độ đọc và mã nguồn, một file `.xlsx`, `.pdf`, `.docx`.
5. Kiểm tra việc xem trước chỉ bắt đầu sau khi người dùng nhấn nút; tệp nén vẫn bị chặn xem trước.
6. Kiểm tra tải xuống, xem thông tin, chia sẻ và thùng rác sau khi thay đổi giao diện.

## Phạm vi đã kiểm tra

- CSS đã qua phân tích cú pháp.
- TypeScript script đã qua kiểm tra cú pháp.
- `git apply --check` và `git apply` thành công trên bản mã nguồn phát hành ngay trước bản này.
- Đã kiểm tra không bị tràn ngang ở 320, 360, 768, 1280, 1536, 1920px bằng Chromium trên giao diện mô phỏng.
- Chưa chạy ứng dụng hoàn chỉnh bằng Nuxt/Docker với tài khoản thật của người dùng; cần kiểm tra sau khi triển khai.
