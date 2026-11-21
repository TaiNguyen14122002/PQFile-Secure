# PQFile Secure — vá lỗi runtime/API 2026-11-21

## Phạm vi sửa

- Trình đọc `.md` sử dụng Markdown-It qua factory thay vì khởi tạo constructor chưa chắc chắn sau ESM/CJS bundling. Có fallback `<pre>` đã escape HTML khi thư viện không khả dụng. Không tắt xác minh ML-DSA/AES-GCM.
- API cung cấp mã lỗi ngẫu nhiên trên lỗi HTTP 5xx và ghi stack nội bộ ở log máy chủ; thông điệp gửi trình duyệt không chứa SQL, khóa, metadata bí mật.
- Kết nối S3/RustFS: HEAD/PUT/GET/DELETE phân biệt lỗi kho lưu trữ 503, ciphertext không tồn tại 404, không tự động tạo bucket khi HEAD 403 hoặc timeout.
- Kiểm tra UUID các route file, nhóm, cảnh báo để tránh lỗi PostgreSQL `invalid input syntax for type uuid` chuyển thành 500.
- Trình duyệt xử lý response HTML của nginx khi API lỗi mà không cố parse thành JSON, hiển thị HTTP status và `errorId` khi có.
- API `/api/health` xác minh thêm bảng `security_events` mà các chức năng an ninh cần.
- Công cụ `scripts/diagnose-pqfile-macos.sh` đọc trạng thái Docker, HTTP, database, kết nối RustFS mà không in mật khẩu.

## Áp dụng bản vá

```bash
cd /duong/dan/thuc/te/pqfile-secure
# Sao lưu dự án hoặc tạo bản sao trước khi vá.
git apply --check '/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Runtime_API_Error_Fixes_2026.patch'
git apply '/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Runtime_API_Error_Fixes_2026.patch'
```

Chỉ chạy `git apply` lần 2 nếu `--check` không có lỗi. `git apply` không đòi hỏi thư mục là Git repository.

## Build lại và kiểm tra

```bash
docker compose up -d --build api web
docker compose ps
bash scripts/diagnose-pqfile-macos.sh
docker compose logs --tail=80 api
```

Trình duyệt: Command + Shift + R. Mở `/files?tab=all`, đăng nhập, mở kho khóa, thử tệp Markdown và một PDF/DOCX/XLSX, thử dashboard, tải lên/tải xuống. Không cần nạp lại dữ liệu; bản vá không chứa migration hoặc làm mất PostgreSQL/RustFS.

Nếu frontend còn báo tên bị minify như `Xe is not a constructor`: mở Developer Tools → Console, lấy **stack trace, đường dẫn file JS và vị trí dòng/cột**, hành động trước khi lỗi xảy ra; không gửi cookies/mật khẩu/bản rõ tệp. Tên `Xe` do minifier đặt, chỉ stack mới xác định được class gốc; không đủ căn cứ để khẳng định tất cả các lỗi cùng nguyên nhân.

Nếu API còn lỗi 500: gửi **mã lỗi UUID** hiển thị trong thông báo cùng dòng log tương ứng từ `docker compose logs --tail=80 api`. Giữ bí mật .env, hai mật khẩu nghiên cứu, khóa riêng, và nội dung tài liệu.

## Hạn chế kiểm thử

Đã chạy 4 bài test cục bộ với Node `--experimental-strip-types`, kiểm tra cú pháp TypeScript và cú pháp shell. Chưa chạy `npm install`, build Nuxt/Nest hoặc Docker end-to-end trong môi trường phát triển bản vá; không cam kết mọi lỗi runtime đã hết trên máy của người dùng.

## Bảo mật

Không thay đổi cốt lõi ML-KEM / ML-DSA, không bỏ kiểm tra chữ ký. Khi S3 lỗi, backend không tự sinh file giả hoặc trả bản rõ. Mật khẩu demo từng được chia sẻ vào chat cần được thay/thu hồi theo quy trình an toàn; mật khẩu kho khóa yêu cầu mã hóa lại backup chứ không thay riêng giá trị Keychain.
