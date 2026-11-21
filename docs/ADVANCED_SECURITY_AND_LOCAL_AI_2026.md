# PQFile Secure – Nhóm 5 chức năng mở rộng (bản nghiên cứu 2026)

Bản này là bản vá tiếp theo **sau `PQFile_Security_5_Features.patch`**, không áp dụng trực tiếp cho mã nguồn ban đầu chưa cập nhật.

## Phạm vi đã triển khai

| Chức năng | Giao diện | Backend / xử lý | Trạng thái thực tế |
|---|---|---|---|
| 1. Gợi ý thu hồi quyền | `/governance` → Đề xuất thu hồi | `GET /governance/review`, `PATCH /governance/grants/:id/deadline`, `DELETE /governance/grants/:id` | Có thể thao tác thật; gợi ý theo quy tắc |
| 2. Bản đồ quan hệ chia sẻ | `/governance` → Bản đồ | `GET /governance/graph` | Sơ đồ SVG thật từ quyền và thành viên nhóm đã lưu |
| 3. Tìm nội dung trong tệp mã hóa | `/smart` | giải mã qua WebCrypto trên trình duyệt, tạo chỉ mục AES-GCM trong IndexedDB | Tìm bằng TF-IDF/từ đồng nghĩa, **chưa phải embedding AI** |
| 4. Tóm tắt / trích xuất | `/smart` và nút trên `/files` | Text extraction + TF-IDF, regex thời hạn; tùy chọn Built-in Summarizer API | Có kết quả thật; AI sinh chỉ khả dụng cho tiếng Anh khi trình duyệt có model cục bộ |
| 5. Phát hiện tệp nguy hiểm | `/upload` | đọc chữ ký nhị phân, định dạng, tên kép, dấu hiệu Office macro/PDF active content | Kiểm tra tĩnh hạn chế; không phải antivirus |

### Kiến trúc bảo mật

- Không tạo endpoint tải văn bản gốc lên máy chủ. Thư viện hiện có vẫn chỉ lưu ciphertext và envelope của khóa.
- Chỉ mục chứa nhãn gốc và tối đa 180.000 ký tự mỗi tệp, **mã hóa AES-256-GCM** trước khi ghi IndexedDB. Khóa chỉ mục được dẫn xuất bằng HKDF SHA-256 từ bí mật KEM trong kho đã mở; có salt theo người dùng và domain separation. Chỉ mục giải mã vào bộ nhớ trong khi người dùng mở khóa. Không gửi chỉ mục tới API.
- Mỗi lượt lập chỉ mục tải lại manifest/ciphertext đã được máy chủ kiểm tra quyền, xác thực và giải mã ở máy khách; khi tìm, chỉ hiển thị những tệp vẫn có trong danh sách `/files/library` trả về hiện thời. Người dùng phải trực tuyến để cập nhật danh sách quyền. Các bản sao đã giải mã cũ **không** bị xóa theo lệnh thu hồi.
- Bản đồ chỉ hiển thị các tệp mà tài khoản là chủ sở hữu và người nhận trực tiếp. Cạnh nhóm là **thành viên nhóm**, không ngụ ý thừa kế quyền đối với tệp.
- `task_deadline_at` chỉ đánh dấu hạn công việc do chủ tệp đặt để **gợi ý**; `expires_at` mới thực thi hết quyền. Không tự thu hồi khi hết hạn công việc, tránh khóa nhầm.
- Thu hồi trực tiếp cập nhật `revoked_at` của quyền, chặn các lượt tải mới. Có ghi audit log.
- Các thuật toán phát hiện rủi ro chỉ là **heuristic**, chưa được đánh giá trên bộ dữ liệu tiêu chuẩn, không được coi là xác suất hay xác nhận chắc chắn.
- PDF.js thực hiện trích xuất lớp văn bản PDF trên trình duyệt, không hỗ trợ OCR. DOCX chỉ trích xuất văn bản chính. Tài liệu có macro, phần nhúng, font đặc biệt hoặc file nén bất thường có thể chưa được quét hết.
- Chức năng AI tùy chọn dùng Summarizer API có sẵn trên trình duyệt (không dùng dịch vụ cloud). Không tự động tải mô hình lớn và không tự chuyển bản rõ sang dịch vụ AI khác khi không tương thích. Kết quả tiếng Việt dùng phương pháp trích xuất, không phải mô hình sinh.

## Cập nhật cơ sở dữ liệu

Lệnh bootstrap sẵn có của Docker (`npm run db:init -w @pqfile/api`) chạy SQL có `ALTER TABLE file_shares ADD COLUMN IF NOT EXISTS task_deadline_at timestamptz;`, không xóa dữ liệu hiện tại. **Sao lưu PostgreSQL trước khi nâng cấp.** Trong sản xuất nên dùng migration theo version có giám sát.

## Triển khai trên MacBook

File PATCH được lưu tại `/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Advanced_5_Features.patch`. Tại thư mục `pqfile-secure` đã áp dụng PATCH đợt 1:

```bash
# Kiểm tra khả năng áp dụng (không chỉnh sửa dữ liệu)
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Advanced_5_Features.patch"

# Áp dụng một lần, khi bước trên không báo lỗi
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Advanced_5_Features.patch"

# Khởi động lại ứng dụng (sau khi sao lưu DB, kiểm tra .env)
docker compose up -d --build
docker compose ps
```

`git apply` có thể dùng được cả với thư mục chưa có `.git` (như máy của bạn); nhưng `git status` và `git diff` yêu cầu repository Git. **Không `git init` chỉ để áp dụng PATCH.** Kiểm tra bằng `ls apps/web/pages/governance.vue apps/web/pages/smart.vue`.

Bản mã nguồn ZIP cũng có sẵn. Nếu dùng ZIP thì giải nén vào thư mục riêng rồi giữ nguyên `.env` hiện tại, tránh ghi đè dữ liệu vận hành.

## Quy trình kiểm thử nhanh (trên máy đã chạy Docker)

1. Đăng nhập tài khoản sở hữu tệp, vào `/governance` và xem quyền đang hiệu lực. Đặt hạn công việc trong quá khứ: hệ thống đề xuất xem xét nhưng chưa thu hồi. Bấm Thu hồi và thử tải tệp ở tài khoản người nhận.
2. Mở tab Bản đồ: xem file → người nhận (đường liền), người nhận → nhóm (nét đứt) nếu có quan hệ nhóm.
3. Ở `/keys` mở kho khóa; tại `/smart` chọn “Lập chỉ mục” cho TXT/DOCX/PDF có lớp văn bản; tìm theo từ khóa hoặc từ liên quan. Đăng xuất rồi truy cập khi kho khóa đóng để kiểm tra không đọc được chỉ mục.
4. Trong `/files`, chọn tệp rồi bấm “Tóm tắt thông minh trên thiết bị”. Với PDF ảnh không có text layer, cần thông báo chưa hỗ trợ OCR. Nút “AI sinh tóm tắt cục bộ” chỉ hoạt động khi trình duyệt cung cấp mô hình và hỗ trợ ngôn ngữ.
5. Ở `/upload`, thử `app.exe` hoặc tệp `.pdf` chứa header ZIP để thấy chặn. Tệp HTML/SVG sẽ cảnh báo và cần xác nhận. Kiểm tra tệp PDF thường không bị nhận diện nhầm là tệp thực thi.

## Kiểm thử mã nguồn

```bash
npm install
node tests/unit/smart-security.test.cjs
```

Bài test unit không thay thế kiểm tra thực tế API, PostgreSQL, Docker, PDF.js hay kiểm thử hiệu năng/pen-test. Cần đánh giá false-positive/false-negative, tải lớn, hết hạn, đồng thời, khả năng chống Zip bomb và tương thích thiết bị trước khi triển khai chính thức.
