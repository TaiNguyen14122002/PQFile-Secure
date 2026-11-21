#!/usr/bin/env bash
# Read-only diagnostics. Does not reveal .env secrets, credentials or key backups.
set -u
cd "$(dirname "$0")/.." || exit 1

section() { printf '\n=== %s ===\n' "$1"; }
section 'Kiểm tra cấu hình Docker Compose'
if ! command -v docker >/dev/null 2>&1; then
  echo 'Không tìm thấy Docker CLI; hãy mở Docker Desktop.'; exit 1
fi
if ! docker compose config --quiet >/dev/null 2>&1; then
  echo 'Cấu hình Compose chưa hợp lệ; kiểm tra Docker Desktop và .env (không chia sẻ nội dung .env).'; exit 1
fi
printf 'Cấu hình Compose: hợp lệ\n'

section 'Trạng thái container'
docker compose ps || exit 1

section 'HTTP qua gateway'
if command -v curl >/dev/null 2>&1; then
  for path in / /api/health /api/auth/me; do
    response=$(curl --silent --output /dev/null --max-time 8 --write-out '%{http_code}' "http://localhost:8080$path" 2>/dev/null) || response='OFFLINE'
    printf '%-18s %s\n' "$path" "$response"
  done
  printf 'Gợi ý: /api/health = 200; /api/auth/me = 401 khi chưa đăng nhập là bình thường.\n'
fi

section 'Dữ liệu PostgreSQL (chỉ số lượng)'
if docker compose exec -T postgres psql -U pqfile -d pqfile -X -Atq -c \
 "SELECT 'files=' || COUNT(*) FROM files;" 2>/dev/null; then
  docker compose exec -T postgres psql -U pqfile -d pqfile -X -Atq -c \
   "SELECT 'file_shares=' || COUNT(*) FROM file_shares;" 2>/dev/null || true
  docker compose exec -T postgres psql -U pqfile -d pqfile -X -Atq -c \
   "SELECT 'security_events=' || COUNT(*) FROM security_events;" 2>/dev/null || true
else
  echo 'Không truy vấn được database. Kiểm tra container postgres / API.'
fi

section 'Cột bắt buộc sau các bản vá'
docker compose exec -T postgres psql -U pqfile -d pqfile -X -Atq -c \
 "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE (table_name='files' AND column_name IN ('source_type','manifest','signature')) OR (table_name='file_shares' AND column_name='task_deadline_at') ORDER BY table_name,column_name;" 2>/dev/null || echo 'Không kiểm tra được schema'

section 'Kết nối API tới dịch vụ storage'
docker compose exec -T api node -e "fetch('http://storage:9000/',{signal:AbortSignal.timeout(4000)}).then(r=>console.log('Storage HTTP '+r.status+' (403/400 ở endpoint gốc vẫn chứng tỏ có kết nối)')).catch(e=>{console.log('Không kết nối được storage');process.exitCode=1})" 2>/dev/null || true

section 'Bước kiểm tra lỗi kế tiếp'
printf '%s\n' 'Nếu lỗi còn xảy ra, chạy: docker compose logs --tail=80 api' 'Tìm dòng [PQFile API] kèm mã lỗi rồi gửi mã lỗi và thao tác gây lỗi (không gửi mật khẩu, khóa hoặc bản rõ tệp).'
