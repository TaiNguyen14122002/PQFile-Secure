# PQFile Secure — nền trường học và dữ liệu nghiên cứu trong cơ sở dữ liệu

## Phạm vi cập nhật

- Ảnh gốc do người dùng cung cấp được tối ưu thành `apps/web/public/campus-background.jpg`.
- Hình nền cố định cho **toàn bộ giao diện** ở layout chung; phủ hai lớp xanh/trắng mờ để chữ đủ tương phản. Các bảng, modal và điều khiển sử dụng nền gần trắng, có responsive.
- Trang chủ (`/dashboard`) dùng API thống kê của người đăng nhập; trang `/upload` giữ nguyên chức năng mã hóa trên trình duyệt.
- Thư viện `/files` dùng được với tệp thật và tệp nghiên cứu: tìm kiếm, xem trước PDF/ảnh/văn bản, phân trang, đổi nhãn, chia sẻ, tải về, xóa/khôi phục. Dữ liệu `RESEARCH` được gắn nhãn nguồn, **nhưng đi qua cùng luồng xác thực và giải mã thật**.
- `/activity` bổ sung API phân trang, hỗ trợ nhiều bản ghi. `/workspaces` và `/shared` dùng tài khoản/nhóm/chia sẻ đã nạp.
- API thư viện bỏ kiểu N+1 truy vấn từng envelope, tối ưu cho tập nhiều tệp.

## Dữ liệu seed và tính chân thực

| Đối tượng | Số lượng | Cách lưu |
| --- | ---: | --- |
| Người dùng | 12 | PostgreSQL `users` (mật khẩu Argon2id) |
| Tệp đang hoạt động | 1.248 | PostgreSQL `files`, RustFS ciphertext |
| Tệp trong thùng rác | 42 | PostgreSQL `files`, RustFS ciphertext |
| Cấp quyền chia sẻ | 367 | `file_shares` + recipient envelopes |
| Nhóm làm việc | 12 | `workspaces`, `workspace_members` |
| Hoạt động | 720 | `activity_logs` |
| Khóa | 12 cặp ML-KEM-768 + ML-DSA-65 | Public keys và bản sao lưu private keys **được mã hóa bằng Argon2id + AES-GCM** |

Dữ liệu được tạo bằng nội dung hoàn toàn nhân tạo, nhưng **mỗi bản ghi tệp có ciphertext vật lý** chứa một tệp PDF, DOCX, XLSX, PNG, CSV, JSON, TXT hoặc ZIP hợp lệ. Mỗi tệp đi qua `encryptFile()` của `@pqfile/crypto-core`: AES-256-GCM, chia khóa bằng ML-KEM-768, ký manifest ML-DSA-65. Không có private key dạng rõ trong PostgreSQL, mã nguồn hoặc object storage.

Dữ liệu mô phỏng được **đối xử như dữ liệu thật về thao tác và liên kết** (đăng nhập, khóa, chia sẻ, tải về, xóa/khôi phục và báo cáo), nhưng không được trình bày là hồ sơ người thật. Các chỉ số dashboard về metadata **không phải kết quả kiểm toán bảo mật**.

## Lệnh triển khai trên MacBook

**Chú ý:** Không nạp dữ liệu mẫu vào máy chủ production. Nên sao lưu PostgreSQL + RustFS trước khi nạp.

```bash
cd "/Volumes/Tai_Nguyen_256GB/NCKH/Source/pqfile-secure"
docker compose up -d --build
bash scripts/seed-research-macos.sh
```

Script hỏi xác nhận `SEED`, sau đó hỏi **hai mật khẩu mạnh khác nhau**. Không có mật khẩu mẫu hard-code. Script chỉ hoạt động khi bạn chủ động cho phép, không tự chạy khi `docker compose up`.

Sau khi chạy thành công:

1. Vào `http://localhost:8080/login`.
2. Email: `demo.admin@pqfile.local`; mật khẩu: mật khẩu đăng nhập vừa đặt.
3. Vào **Khóa mật mã**, dùng mật khẩu kho khóa thứ hai để mở bản sao lưu được seed. Đừng bấm “Tạo khóa mới” vì khóa đã được tạo.
4. Vào **Trang chủ**, **Tệp tin**, **Chia sẻ**, **Nhóm làm việc**, **Lịch sử** để kiểm thử số liệu.
5. Mở một PDF từ **Tệp tin**: bấm Xem trước hoặc Giải mã & tải xuống. Kết quả phải được xác minh chữ ký/giải mã trên trình duyệt.

Lưu ý: số lượng trong **trang chủ** là số tệp và lượt chia sẻ mà **tài khoản demo.admin** truy cập được, không phải tổng số toàn hệ thống. Không phải tất cả tệp được nạp đều thuộc cùng một chủ sở hữu.

## Kiểm tra PostgreSQL và RustFS

```bash
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT source_type,status,COUNT(*) FROM files GROUP BY source_type,status ORDER BY 1,2;"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT dataset_id,file_count,share_count,completed_at FROM research_seed_runs;"
docker compose exec postgres psql -U pqfile -d pqfile -c "SELECT COUNT(*) FROM file_shares;"
docker compose logs --tail=60 api
```

Nếu hệ thống có dữ liệu riêng từ trước, tổng `files` và `file_shares` sẽ nhiều hơn số seed. Để chỉ đếm seed, lọc `files.source_type='RESEARCH'` và bảng marker `research_seed_runs`.

## Chạy lại và phục hồi

- Lần chạy thành công sẽ có marker `research_seed_runs` để **không tự nhân đôi, không làm sống lại các tệp đã xóa**. Chạy lại sẽ thông báo đã tồn tại.
- Nếu kết nối kho S3/PostgreSQL ngắt giữa lúc tạo, cùng hai mật khẩu ban đầu có thể chạy lại; những record có ID xác định đã tồn tại sẽ được bỏ qua, phần thiếu được bổ sung.
- **Không** đổi mật khẩu kho khóa giữa các lần chạy seed chưa hoàn tất (bản sao lưu khóa cần mật khẩu ban đầu).
- Để xóa toàn bộ dữ liệu nghiên cứu, cần quy trình làm sạch riêng có xác nhận và sao lưu; **không chạy** `docker compose down -v` để tránh mất dữ liệu thật.
- Seed chủ động lưu ciphertext do script tạo phía server **chỉ trong môi trường nghiên cứu**. Điều này không thay đổi luồng tải tệp thật: private key vẫn sinh và mã hóa cục bộ tại trình duyệt của người dùng thực.

## Giới hạn kiểm thử

Đã kiểm tra cú pháp TypeScript và định dạng tệp được tạo bằng công cụ kiểm tra độc lập (ZIP, PNG, PDF). Do không có Docker, PostgreSQL và các node_modules tại môi trường biên soạn, chưa thể chạy được seed thật trên cơ sở dữ liệu của bạn hoặc xác minh tích hợp từ đầu đến cuối. **Chỉ coi seed thành công sau khi Terminal thông báo Completed và truy vấn PostgreSQL trả về số liệu đúng.**
