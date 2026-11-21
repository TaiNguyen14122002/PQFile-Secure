# PQFile Secure – Mô phỏng, tư vấn cấu hình, kiểm tra thiết bị (2026)

## Phiên bản nền

Bản mã nguồn `PQFile_Secure_PQC_Advanced_5_Features_2026.zip`, tức **trước** khi thêm 20 chức năng 16–35. Trang thư viện tệp, dashboard mới, sidebar, header và hệ thống dữ liệu giữ nguyên.

## Giao diện

- URL công khai: `/onboarding` — dùng được trước đăng ký; tài khoản đã đăng nhập thấy thêm trong sidebar `Mô phỏng & tư vấn`.
- 3 tab: `Mô phỏng mật mã` / `Tư vấn cấu hình` / `Kiểm tra thiết bị`.
- Bố cục 2 cột khi có đủ không gian, 1 cột trên điện thoại; nền #F4F7FC, thẻ trắng, tiêu đề nền trắng chuyển xanh rất nhạt.

## Nghiệp vụ thực sự được cài đặt

### 1. Mô phỏng

- Chọn **mẫu văn bản** hoặc tệp tối đa **512 KiB**; byte tệp chỉ được đọc tại thiết bị. Không được tải lên server.
- Ba chế độ so sánh bằng phép tính **thực**: X25519 + ECDSA P-256; ML-KEM-768 + ML-DSA-65; lai X25519 + ML-KEM-768 và chữ ký kép ECDSA + ML-DSA.
- Sinh khóa thử nghiệm độc lập; thiết lập bí mật; dẫn xuất AES-256 key qua HKDF-SHA-256 với salt và context; mã hóa AES-256-GCM; ký ciphertext; xác minh chữ ký; giải mã; đối chiếu byte.
- Đo thời gian `performance.now()` cho 6 giai đoạn và tổng thể; hiển thị kích thước khóa công khai, dữ liệu trao đổi, chữ ký, bản mã. Kết quả phép thử cục bộ, không phải benchmark chuẩn hóa.
- Khóa bí mật thử nghiệm không hiển thị trên màn hình; không dùng khóa kho vault tài khoản; không gửi lên API hoặc lưu localStorage. Byte bí mật của thư viện JS được ghi đè 0 khi thực tế khả thi; khóa WebCrypto private là non-extractable.
- **Giới hạn**: Không thay thế cơ chế mã hóa file production, không đánh giá đầy đủ hiệu năng thiết bị, không thay thế chứng nhận FIPS.

### 2. Tư vấn cấu hình

Quy tắc minh bạch theo loại tài liệu, nhạy cảm, số người nhận, năm cần bảo vệ, quy mô dữ liệu và người ngoài tổ chức. Xuất gợi ý thuật toán, thời hạn chia sẻ, phân quyền, kiểm tra người nhận, sao lưu, chi phí và lý do. **Không phải AI học máy** và không tự ghi chính sách xuống API.

### 3. Tương thích thiết bị

- Kiểm tra HTTPS/localhost secure context, WebCrypto, HKDF, X25519.
- Thử đọc Blob 128 KiB và mã hóa/giải mã AES-256-GCM; kiểm tra khóa ML-KEM-768 bằng cặp thử nghiệm, đo thời gian.
- Đọc `navigator.deviceMemory` khi có (đây **không** phải RAM trống), `navigator.hardwareConcurrency` khi có. Không đọc số serial hoặc fingerprint thiết bị.
- Trả kết luận Tốt / Giới hạn / Chưa đáp ứng, lưu báo cáo JSON về máy theo lựa chọn người dùng. Không gửi dữ liệu lên API.

## Thay đổi file

- Thêm `apps/web/pages/onboarding.vue`.
- Thêm `apps/web/utils/onboarding-lab.ts`, `protection-advisor.ts`.
- Thêm `apps/web/assets/css/onboarding-lab.css`.
- Thêm `tests/unit/protection-advisor.test.mjs`, `tests/unit/onboarding-lab.ts`.
- Sửa `apps/web/nuxt.config.ts`, `layouts/default.vue`, `middleware/auth.global.ts`, `pages/login.vue`, `pages/register.vue`, `package.json`.
- Không thay đổi NestJS API, cơ sở dữ liệu hay khóa tài khoản.

## Triển khai

1. Sao lưu mã nguồn dự án. Áp dụng PATCH chỉ trên mã nguồn phiên bản trước chức năng 16–35:

```sh
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Crypto_Onboarding_3_Features_2026.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Crypto_Onboarding_3_Features_2026.patch"
```

2. Build giao diện: `docker compose up -d --build web`.
3. Mở `http://localhost:8080/onboarding`; nhấn `Command + Shift + R`.
4. Thử 3 chế độ bằng tệp mẫu nhỏ, kiểm tra xác minh; thử 3 bộ tiêu chí tư vấn; bấm kiểm tra thiết bị.
5. Chạy kiểm thử quy tắc: `npm run test:onboarding-advisor` (chỉ cần Node >=22).
6. Khi npm dependencies của dự án đã được cài đủ (gồm các thư viện mật mã của dự án), chạy `npm run test:onboarding-crypto`; hoặc build và kiểm tra trực tiếp trong trình duyệt. Không sử dụng kết quả kiểm thử này để khẳng định đã đạt chứng nhận an toàn.

## Kiểm thử ở môi trường tạo bản vá

- Kiểm thử quy tắc: chạy được 6/6.
- Kiểm tra cú pháp và TypeScript DOM: đạt trên phần tiện ích cục bộ; kiểm tra template Vue tĩnh.
- **Chưa chạy** Nuxt build hay các phép tính ML-KEM/ML-DSA bằng thư viện thật do không truy cập được npm registry trong môi trường này. Cần kiểm thử bằng Docker trên MacBook.
