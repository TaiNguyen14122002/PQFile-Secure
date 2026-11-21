# HTTP 500 — PQFile Secure (Docker / MacBook)

## 1. Lỗi nói lên điều gì?

HTTP 500 là lỗi máy chủ trả về khi thực hiện API, không phải bằng chứng cho một nguyên nhân duy nhất. Log **container api** là nguồn chẩn đoán chính; đừng xóa volume hoặc in secret.

## 2. Kiểm tra từ thư mục pqfile-secure

```bash
docker compose ps
docker compose logs --tail=150 api
docker compose logs --tail=80 postgres
curl -i http://localhost:8080/api/health
```

- `200` và `schema: ready`: database kết nối được và đã có bảng MVP. Nếu vẫn 500, kiểm tra log API **ngay sau thao tác gây lỗi**, ghi lại endpoint.
- `503` tại `/api/health`: API chưa kết nối DB hoặc thiếu bảng; xem lỗi khởi tạo schema trong log.
- `502 Bad Gateway` hoặc `504`: container API hoặc Web chưa sẵn sàng; xem `docker compose ps`, log `gateway`, `web`, `api`.
- `Connection refused`: gateway chưa chạy/không có cổng 8080; xem `docker compose ps`.

## 3. Nguyên nhân liên quan bản MVP trước

Bản trước chạy `drizzle-kit push` trong entrypoint với `strict: true`; Drizzle yêu cầu xác nhận, không phù hợp quá trình tự chạy trong container. Bản sửa chuyển sang SQL khởi tạo idempotent, **chỉ thêm bảng/index khi chưa có**, không chạy `DROP`/`ALTER`.

## 4. Áp dụng bản vá

Đảm bảo đã đứng trong đúng thư mục `pqfile-secure`; áp dụng file `.patch` với `git apply --check` rồi `git apply`. Chạy lại:

```bash
docker compose up --build -d
docker compose ps
curl -i http://localhost:8080/api/health
```

**Không chạy** `docker compose down -v` hoặc lệnh `DROP TABLE`: sẽ mất dữ liệu. Không đăng công khai mật khẩu DB, cookie session, khóa riêng và nội dung `.env` khi gửi log.

## 5. Giới hạn

Nếu PostgreSQL đã tồn tại nhưng schema bị thay đổi hoặc bị hỏng, `CREATE TABLE IF NOT EXISTS` không sửa cột/index cũ. Cần xem log và migration đúng tình trạng DB trước khi chỉnh sửa. Đây là bản MVP, chưa đạt mức production.
