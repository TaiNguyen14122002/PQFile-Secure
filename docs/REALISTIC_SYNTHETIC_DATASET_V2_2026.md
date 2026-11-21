# PQFile Secure — Bộ dữ liệu nghiệp vụ tổng hợp V2 (21/11/2026)

## Mục tiêu

Cung cấp dữ liệu **giả lập có tính liên kết** để thử nghiệm sản phẩm nghiên cứu khoa học PQFile Secure: quản lý tài liệu đã mã hóa, phân quyền/chia sẻ, thu hồi quyền, đồ thị rò rỉ, thống kê, nhật ký hoạt động, cảnh báo an ninh, tìm kiếm/tóm tắt trên thiết bị.

- **Không phải dữ liệu người thật**: mọi tên tài khoản thuộc nhóm `demo.*@pqfile.local`; tên nhân sự chỉ là nhân vật giả lập, email trong tài liệu có miền `.example`. Các ngày, khoản kinh phí, tình huống, tiến độ và cảnh báo đều được sinh tự động.
- **Dữ liệu vận hành là thật**: bộ seed tạo các tệp hợp lệ PDF, DOCX, XLSX, TXT, CSV, JSON, PNG, ZIP, sau đó **mã hóa bằng luồng `encryptFile` ML-KEM-768 + AES-256-GCM + chữ ký ML-DSA-65** và lưu ciphertext trong S3 tương thích. PostgreSQL giữ metadata, grants, envelopes và audit logs. Không có dữ liệu giả từ việc chặn API trên frontend.
- **Không gửi nội dung bản rõ lên API** trong luồng sử dụng thường ngày. Riêng công cụ nạp seed này tạo bản rõ và mã hóa trong container API **chỉ ở môi trường nghiên cứu**, không được coi là bảo đảm tính chất zero-knowledge trong quy trình nhập dữ liệu giả.
- Giới hạn: các dữ liệu có tính "gần thực tế" về hình thức và quan hệ, **không đại diện phân bố thực tế của doanh nghiệp/người dùng/đối thủ, và không đủ để công bố độ chính xác AI hoặc hiệu năng bảo mật**.

## Đầu vào, đầu ra

Bản V2 **bổ sung** vào bộ seed V1 (12 người dùng, 1.290 tệp, 367 lượt chia sẻ, 12 nhóm, 720 hoạt động). Không thay đổi tệp ciphertext của V1 hoặc dữ liệu cá nhân khác.

| Hạng mục V2 | Số lượng | Nơi lưu |
| --- | ---: | --- |
| Hồ sơ nghiệp vụ | 144 | PostgreSQL `files`, S3 ciphertext thực |
| Cấp quyền chia sẻ | 176 | `file_shares`, `file_recipients` |
| Hoạt động theo thời gian | 1.115 | `activity_logs` |
| Dấu hiệu đăng nhập và cảnh báo | 180 | `security_events` |
| Định dạng tài liệu | 8 | PDF, DOCX, XLSX, TXT, CSV, JSON, PNG, ZIP |
| Người dùng | 12 | Tái sử dụng 12 tài khoản seed V1 (không tạo tài khoản mới) |
| Nhóm làm việc | 12 | Tái sử dụng 12 nhóm V1 |

Sau khi nạp **cả V1 và V2** vào hệ thống trống, tổng số dự kiến là 1.434 tệp, 543 quyền chia sẻ, 1.835 hoạt động, 180 sự kiện an ninh. Các tổng này không bao gồm dữ liệu thật hoặc các sự kiện mới phát sinh khi người dùng thao tác.

## Những tình huống được mô phỏng

1. **Tài liệu**: 18 chủ đề nghiệp vụ (an ninh, tài chính, bảo mật hậu lượng tử, tiến độ, tuân thủ, vận hành), có mã hồ sơ, tên người phụ trách giả, trạng thái, ngày lập, hạn hoàn thành, chi phí và các đoạn mô tả nhiệm vụ.
2. **Phân quyền**: quyền không có hạn, hết hạn, đã thu hồi, gần/hết hạn nhiệm vụ; người nhận khác chủ sở hữu; mỗi quyền có một envelope ML-KEM để kiểm tra giải mã hợp lệ theo chính sách.
3. **Đồ thị chia sẻ**: một số hồ sơ được chia sẻ cho 2–3 người, nhóm đã tồn tại trong V1; quan hệ thành viên nhóm **không** tự tạo quyền truy cập file.
4. **Nhật ký**: có sự kiện tải lên, đổi nhãn, chia sẻ, thu hồi, quản trị công việc và tải ciphertext; nhật ký tải có căn cứ từ quyền người nhận và nằm trong thời gian quyền có hiệu lực.
5. **An ninh**: các tình huống mô phỏng trình duyệt lạ, tải dồn dập, truy cập bị từ chối; điểm 0–100, một phần được xác nhận. **Điểm rủi ro và nhãn là nhãn kịch bản do trình sinh dữ liệu tạo**, không phải kết luận phát hiện sự cố có thật.
6. **AI trên thiết bị**: TXT/DOCX có nội dung tiếng Việt cho phân loại/tóm tắt, PDF chỉ chứa chữ Latin không dấu do bộ mã hóa PDF tối giản; ảnh PNG chưa có OCR. Chỉ mục tìm kiếm cục bộ phải được người dùng mở khóa và tạo bằng thao tác phù hợp trong giao diện hiện có, không có việc nạp chỉ mục bản rõ từ seed lên máy chủ.

## An toàn trước khi chạy

- **Chỉ chạy trên một bộ PostgreSQL + S3 riêng cho demo, không phải production.** Không trộn dữ liệu thật với dữ liệu nghiên cứu nếu có thể tránh.
- Sao lưu cả **PostgreSQL và RustFS/S3** trước khi chạy; không sử dụng `docker compose down -v` để xử lý lỗi.
- Bản seed mới có 2 biến xác nhận: `DEMO_REALISTIC_ENABLED=yes`, `DEMO_DATASET_CONFIRM=RESEARCH_ONLY`. Shell hỏi đúng chữ `RESEARCH_ONLY` và mật khẩu kho khóa V1 (không lưu vào file).
- Mỗi bộ V2 có ID xác định. Nếu lỗi giữa chừng, chạy lại với **cùng mật khẩu kho khóa V1**, câu lệnh dùng `ON CONFLICT DO NOTHING` cho hoạt động, cảnh báo và bỏ qua các tệp đã tồn tại; marker `research_seed_runs` ngăn nạp trùng sau khi thành công. Nếu tệp S3 bị xóa sau seed, cần phục hồi S3 từ backup, không tự động coi marker là bằng chứng đủ file tồn tại.
- Nên chạy trên bản nâng cấp 10 chức năng đã có cột `file_shares.task_deadline_at` và bảng `security_events`.

## Các bước triển khai trên MacBook

Trên thư mục `pqfile-secure` sau khi áp dụng PATCH:

```bash
cd "/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure"
docker compose up -d --build
```

**Nếu chưa từng nạp bộ seed V1** vào database này:

```bash
bash scripts/seed-research-macos.sh
```

**Sau đó nạp V2** (dùng **mật khẩu kho khóa đã đặt ở V1**, không phải mật khẩu đăng nhập):

```bash
bash scripts/seed-realistic-macos.sh
```

Mở `http://localhost:8080`, đăng nhập tài khoản nghiên cứu `demo.admin@pqfile.local` bằng mật khẩu đăng nhập đã đặt khi nạp V1. Tại trang khóa mật mã mở vault bằng mật khẩu kho khóa V1. Truy cập `/dashboard`, `/files`, `/shared`, `/workspaces`, `/governance`, `/security`, `/activity` để kiểm tra.

## Xuất bộ dữ liệu CSV/JSON để đánh giá trước khi nạp

Chạy trên MacBook chỉ cần **Node 22+**, không cần Docker:

```bash
node scripts/export-realistic-plan.mjs "./synthetic-preview" "2026-11-21"
```

Tạo `tai_khoan.csv`, `tai_lieu.csv`, `chia_se.csv`, `nhat_ky.csv`, `su_kien_an_ninh.csv`, `manifest.json` và 8 tệp mẫu plaintext. CSV giữ nguyên dấu tiếng Việt (UTF-8 BOM) và tham chiếu bằng `fileId`, `id`. Đây là bản xem trước ngoại tuyến, **không phải kết quả SELECT truy vấn live từ PostgreSQL**. Dữ liệu thực nạp bởi V2 có thể mang mốc ngày khác nếu chạy ngày khác. Không dùng CSV preview thay cho dữ liệu giao diện khi nghiệm thu API/mã hóa.

## Kiểm tra database

```bash
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT source_type, status, COUNT(*) FROM files GROUP BY 1, 2 ORDER BY 1, 2;"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT dataset_id, file_count, share_count FROM research_seed_runs ORDER BY dataset_id;"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT COUNT(*) AS v2_tai_lieu FROM files WHERE object_key LIKE 'research/pqfile-realistic-research-v2/%';"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT COUNT(*) AS v2_quyen FROM file_shares WHERE file_id IN (SELECT id FROM files WHERE object_key LIKE 'research/pqfile-realistic-research-v2/%');"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT COUNT(*) FROM activity_logs WHERE details->>'syntheticDataset'='pqfile-realistic-research-v2';"
```

Chạy kiểm tra nguồn bằng Node 22+:

```bash
node --test tests/unit/realistic-dataset.test.mjs
```

## Giới hạn khi nghiệm thu

- Đã kiểm tra ngoại tuyến định dạng tệp, liên kết dữ liệu và các bất biến của quyền chia sẻ. Chưa có kết nối vào PostgreSQL/S3 của máy người dùng để chạy seed từ đầu đến cuối hoặc kiểm chứng giải mã end-to-end bằng ứng dụng chạy thật.
- Khi đánh giá AI, phải tách dữ liệu huấn luyện/kiểm thử và ghi rõ rằng nhãn phân loại/rủi ro được **tạo theo kịch bản**, không phải ground truth thủ công từ hồ sơ thật.
- Thu hồi quyền chỉ chặn việc sử dụng mới theo chính sách. Không thể thu hồi bản tệp đã được giải mã và tải xuống trước đó.
