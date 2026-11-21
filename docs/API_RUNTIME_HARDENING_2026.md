# PQFile Secure — API hardening (21/11/2026)

## Phiên bản dùng làm gốc

Bản `PQFile_Secure_Upload_Full_Viewport_2026.zip` sau khi hoàn tác chức năng 16–35, đã tích hợp onboarding và trang upload toàn màn hình. Bản vá không thay đổi frontend, schema PostgreSQL hoặc khóa mật mã; **phải kiểm tra `git apply --check` trên mã nguồn MacBook** trước khi áp dụng.

## Các lỗi đã xử lý trong mã nguồn

1. Phân loại lỗi PostgreSQL thường gặp thay vì trả `500` chung: unique/foreign key/đồng thời `409`; dữ liệu/sai định dạng `400`; bảng/cột còn thiếu hoặc kết nối DB gián đoạn `503`. Lỗi vẫn nhận errorId khi là 5xx; không trả SQL hoặc dữ liệu nội bộ cho người dùng.
2. Chuẩn hóa timestamp kiểu `Date` hoặc ISO string trong thư viện, Dashboard và rà soát quyền. Giá trị ngày hết hạn không hợp lệ bị xử lý theo hướng **không cấp quyền**.
3. Tránh ghi đè ciphertext khi hai lượt tải lên có cùng file ID: mỗi lần PUT dùng khóa đối tượng ngẫu nhiên, sau đó lưu objectKey thật trong DB; rollback lỗi chỉ xóa đối tượng của lượt tải đó.
4. Tham số query bị gửi nhiều lần/kiểu mảng/kiểu object (`?q=a&q=b`) nay trả `400` thay vì gây TypeError `500`, ở tìm người nhận, nhật ký và cảnh báo. Phân trang được kiểm tra kiểu số nguyên.
5. Health check xác nhận thêm các bảng/cột cần thiết cho PQC nâng cao. `healthy` giờ phát hiện được một số schema migration chưa hoàn thành thay vì chỉ kiểm tra các bảng cốt lõi.
6. Thêm script chẩn đoán read-only `scripts/diagnose-api-macos.sh [error-id]` và kiểm thử hồi quy Node `npm run test:api-runtime`.

## Triển khai an toàn

Đứng tại thư mục gốc `pqfile-secure`:

```bash
# 1. Sao lưu trước khi sửa
mkdir -p backups
docker compose exec -T postgres pg_dump -U pqfile -d pqfile -Fc > "backups/pqfile_before_api_fix_$(date +%Y%m%d_%H%M%S).dump"
# 2. Đảm bảo bản vá nằm ở /Volumes/Tai_Nguyen_256GB/NCKH/Source/
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_API_Runtime_Hardening_2026.patch"
# 3. Chỉ nếu --check KHÔNG có lỗi
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_API_Runtime_Hardening_2026.patch"
# 4. Build API; không cần build frontend
docker compose up -d --build api
# 5. Kiểm tra
docker compose ps
bash scripts/diagnose-api-macos.sh
```

Nếu `--check` báo lỗi do mã nguồn trên máy khác bản gốc, **không dùng `git apply --reject`, không sao chép toàn bộ ZIP đè lên dữ liệu**. Hãy đối chiếu tệp bị xung đột.

## Kiểm thử

`npm run test:api-runtime` trên máy có Node 22+ (không yêu cầu database). Thử thêm: đăng nhập, GET `/api/dashboard/overview`, GET `/api/governance/review`, GET `/api/files/library`, tạo/xóa tệp nghiên cứu, GET `/api/activity/paged`, `/api/security/alerts/paged`, kiểm tra dữ liệu vẫn giải mã được bằng các khóa cũ.

`curl -i http://localhost:8080/api/health` phải trả `200`. Cần kiểm tra cả UI và server logs khi đăng nhập; các truy vấn yêu cầu cookie phiên.

## Những phần CHƯA được xác minh

- Chưa chạy Docker/NestJS thực với PostgreSQL và RustFS của người dùng; chưa xác nhận mọi chức năng không còn lỗi runtime. Không có tập log đầy đủ cho toàn bộ API.
- Chưa thực hiện kiểm thử stress, phân quyền giữa nhiều phiên, đua tranh upload trên RustFS thật, kiểm thử mật mã ML-KEM/ML-DSA hoặc audit bảo mật độc lập.
- Health `200` kiểm tra schema, **không** kiểm tra toàn vẹn ciphertext/khả năng giải mã hoặc chất lượng khóa.
- Nếu còn HTTP 500, chạy `bash scripts/diagnose-api-macos.sh <error-id>` và cung cấp log sau khi xóa mọi thông tin bí mật.
- Không chạy `docker compose down -v`. Nếu còn cảnh báo `SECURITY_HMAC_KEY missing`, cấu hình khóa HMAC ngẫu nhiên 32 byte trở lên trong `.env` để định danh giả thiết bị không bị đổi sau restart; không in khóa lên chat.
