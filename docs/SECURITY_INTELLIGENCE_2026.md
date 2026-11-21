# PQFile Secure — 5 chức năng phân tích và bảo vệ thông minh (bản nghiên cứu)

**Phạm vi:** tích hợp ngay trên mã nguồn Nuxt 4 / Vue 3 / NestJS / PostgreSQL của dự án. Đây là mô hình nghiên cứu (prototype), **không phải sản phẩm đã kiểm thử an toàn bảo mật hoặc AI được đánh giá chất lượng trên dữ liệu thực**.

## I. Vị trí giao diện

1. **Tải lên** (`/upload`): ngay dưới danh sách tệp chọn có bảng quét phân loại, thông tin cá nhân, gợi ý mã hóa, lựa chọn bản sao che dữ liệu. Trong cột **Thiết lập bảo vệ** có bảng hiệu năng ML-KEM và cảnh báo rủi ro trước khi chia sẻ ngay lúc tải lên.
2. **Tệp tin → Quản lý chia sẻ** (`/files`): mở modal của tệp để giải mã **tại trình duyệt** và phân tích lại bản gốc (nếu có kho khóa). Chọn người nhận, hạn chia sẻ 7 ngày mặc định, xem điểm rủi ro rồi xác nhận trước khi cấp quyền. Nếu tệp văn bản có thông tin nhạy cảm, có thể tải bản sao đã che về máy và tải lên riêng.
3. **An ninh** (`/security`): xem cảnh báo đăng nhập với trình duyệt lạ, tải nhiều lần, cố truy cập trái quyền. Dấu chỉ thị cảnh báo chưa xem xét xuất hiện cạnh mục **An ninh** trong menu (cập nhật khi điều hướng).

## II. Chức năng và kỹ thuật

| # | Chức năng | Có thể thực hiện trong prototype | Hạn chế quan trọng |
| --- | --- | --- | --- |
| 1 | Đánh giá rủi ro chia sẻ | Chấm 0–100 theo mức nhạy cảm, người nhận hiện có, thời hạn chia sẻ, cảnh báo an ninh, phạm vi quét; cảnh báo và yêu cầu xác nhận khi rủi ro cao/không quét đủ | Bộ điểm mang tính gợi ý, không phải hệ thống chính sách được kiểm định; không xác minh fingerprint tự động |
| 2 | AI phân loại tài liệu | Naive Bayes đa thức (Multinomial NB) *huấn luyện từ tập mẫu nhỏ được đóng kèm*, chạy cục bộ, kết hợp quy tắc từ khóa và PII; 4 mức; người dùng có thể sửa | Chưa có tập huấn luyện/validation dữ liệu thực, điểm mô hình chưa được hiệu chuẩn; chỉ thử nghiệm; không bảo đảm phân loại chính xác |
| 3 | Phát hiện truy cập bất thường | API ghi metadata phiên, tính số lượt theo cửa sổ: thiết bị trình duyệt mới (User-Agent đã băm HMAC), 5/10 lượt tải trong 60s, 3/7 truy cập trái quyền trong 5 phút; hiển thị và xác nhận cảnh báo | Thuật toán dựa trên luật và thống kê, chưa phải mô hình ML; không chặn phiên/MFA tự động; User-Agent dễ bị giả mạo; chưa có cảnh báo email/push |
| 4 | Gợi ý cấu hình bảo mật | Khuyến nghị mức ML-KEM-512/768/1024, hiển thị cảnh báo nếu không giống cấu hình chọn và đo keygen / encaps / decaps thực tế cục bộ | Không tự chuyển tham số khóa hiện có; chỉ khuyến nghị, không cấp/đổi khóa; AES-GCM vẫn mã hóa nội dung như cũ |
| 5 | Nhận diện PII và che dữ liệu | Dò CCCD (dạng số), điện thoại, email, tài khoản có từ khóa tài chính, địa chỉ; chỉ hiển thị một phần đã che; với TXT/MD/CSV/LOG/TSV tạo bản sao với `[ĐÃ ẨN]` rồi mã hóa hoặc tải về | Regex có báo nhầm và bỏ sót; không có OCR, phân tích cấu trúc bảng, file nhúng hoặc che PDF/DOCX hình ảnh; không sửa bản gốc |

### Định dạng được quét

- **TXT/MD/CSV/LOG/JSON/XML/HTML/YAML/TSV:** đọc nội dung văn bản **tối đa 2 MiB đầu tiên**; nếu vượt giới hạn thì trạng thái *chưa quét đủ*, bắt buộc phân loại thủ công.
- **DOCX:** giải nén `word/document.xml` ngay tại trình duyệt bằng `DecompressionStream`. Chỉ quét văn bản chính, **không quét** header/footer/ảnh/chữ trong ảnh hay tệp nhúng; luôn thông báo *chưa quét đủ* và bắt buộc chọn mức thủ công. Trình duyệt không hỗ trợ `deflate-raw` hoặc DOCX bất thường sẽ thông báo quét không thành công.
- **PDF/PNG/JPG/XLSX/PPTX/ZIP/...:** **chưa có parser hoặc OCR cục bộ**, phải chọn mức thủ công. **Không có chuyện đã quét nội dung các định dạng này.**

### Nguyên tắc quyền riêng tư

- Phân tích trước khi mã hóa chỉ xảy ra trong RAM trình duyệt. Không gọi API AI bên thứ ba. Không gửi plaintext, mô hình phân loại hay kết quả PII lên máy chủ.
- Server chỉ ghi event không có bản rõ (`user_id`, loại, điểm, lý do, thời gian, và giả định thiết bị đã băm HMAC). Không lưu IP/UA gốc; dấu HMAC là tín hiệu yếu, không phải xác thực thiết bị.
- Dữ liệu PII phát hiện chỉ hiện dạng che một phần. Bản sao che nội dung luôn được tạo mới bằng `File` trong bộ nhớ, không ghi đè tệp gốc trên máy của người dùng.
- Nếu người dùng cố hạ mức bảo mật xuống thấp hơn mức gợi ý, điểm rủi ro / khuyến nghị mã hóa vẫn dựa trên mức cao hơn để không vô tình bỏ qua cảnh báo.
- Khả năng thu hồi quyền truy cập chỉ ngăn lượt tải *mới*, không thể thu hồi bản đã được người nhận tải/giải mã trước đó.

## III. File mã nguồn

- `apps/web/utils/security-analysis.ts`: mô hình NB, nhận diện PII, đánh giá rủi ro, khuyến nghị, đọc DOCX, tạo bản sao đã che.
- `apps/web/pages/upload.vue`: các bảng phân loại, che dữ liệu, kiểm tra rủi ro trước upload/chia sẻ, benchmark.
- `apps/web/pages/files.vue`: đánh giá trên tệp đã lưu, quản lý hạn chia sẻ, xuất bản sao che.
- `apps/web/pages/security.vue`: trung tâm cảnh báo.
- `apps/web/layouts/default.vue`: điều hướng / số cảnh báo.
- `packages/crypto-core/src/index.ts`: benchmark ML-KEM không tác động vào kho khóa.
- `apps/api/src/security/`: phát hiện bất thường API và REST cảnh báo.
- `apps/api/src/files/files.controller.ts`: theo dõi tải, truy cập trái quyền, thời hạn khi chia sẻ ngay lúc upload.
- `apps/api/src/auth/auth.controller.ts`: theo dõi dấu hiệu trình duyệt khi đăng nhập thành công.
- `apps/api/src/db/schema.ts` và `database/migrations/0000_initial.sql`: thêm bảng `security_events` bằng DDL thêm mới, không xóa dữ liệu.

## IV. Cài đặt / khởi động

Từ thư mục dự án:

```bash
cp .env.example .env   # Chỉ dùng khi chưa có .env. Nếu đã có, giữ .env và bổ sung biến mới.
```

Tạo giá trị ngẫu nhiên dài, riêng tư cho `SECURITY_HMAC_KEY` và đặt trong `.env`. Không dùng giá trị `CHANGE_ME...` của ví dụ.

```bash
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 api
```

Truy cập `http://localhost:8080/upload`, `/files`, `/security`. Khi API khởi động, `apps/api/scripts/init-db.mjs` chạy lệnh khởi tạo thêm bảng mới. Với DB đã có dữ liệu, **sao lưu DB** và kiểm tra migration trước khi chạy. Nếu cài native để phát triển: dùng Node.js **>=22** và `npm install`; mạng npm cần hoạt động khi cài mới.

### Thử nghiệm bộ phân tích (không cần npm install)

```bash
node --experimental-strip-types --test tests/unit/security-analysis.test.mjs
```

### Mẫu thử tay

1. Tải một tệp `.txt` chứa chuỗi CCCD 12 chữ số, điện thoại và email giả để nhìn thấy các vị trí đã che; đánh dấu tạo bản sao che; sau đó tải xuống để bảo đảm bản gốc không bị sửa.
2. Tải PDF hoặc XLSX và xác nhận giao diện bắt buộc chọn mức bảo mật thủ công, không thông báo đã kiểm tra đầy đủ.
3. Chọn người nhận khác, quan sát điểm rủi ro tăng khi chọn **không giới hạn** thời hạn. Có thể tải lên sau khi xác nhận rủi ro; máy chủ lưu hạn chia sẻ (nếu có).
4. Trong `/files`, chọn “Quản lý chia sẻ” sau khi mở kho khóa, xem lại cảnh báo và chia sẻ với hạn 7 ngày mặc định.
5. Tải tệp đã mã hóa từ một tài khoản 5 lần trong 60 giây. Vào `/security` xem cảnh báo; đánh dấu Đã xem xét.
6. Chạy benchmark ML-KEM trên `/upload`, so sánh thời gian thực tế giữa các thuật toán, xác nhận không tự thay đổi bộ khóa.

## V. Việc cần triển khai trước sản phẩm thực tế

1. Huấn luyện/đánh giá mô hình phân loại trên tập tài liệu tiếng Việt được gán nhãn, đo accuracy, F1, recall theo loại nhạy cảm; calibration và kiểm tra thiên lệch / sai số.
2. Thêm trích xuất PDF, XLSX, PPTX, OCR ảnh và làm mờ PDF/DOCX/ảnh bằng engine sửa tệp riêng có kiểm tra trực quan (tránh xóa hiển thị nhưng để lại dữ liệu trong metadata/text layer).
3. Cấu hình chính sách tập trung server-side, audit có bảo vệ sửa đổi, thông báo thời gian thực, MFA và step-up auth; xử lý ngoại lệ false positive, quản trị phân quyền.
4. Kiểm toán lưu trữ, CSPRNG/mật mã, chứng thực danh tính khóa công khai, hardening trình duyệt, bảo vệ dữ liệu cá nhân theo quy định áp dụng; không xem bản nghiên cứu là chứng nhận an toàn.
