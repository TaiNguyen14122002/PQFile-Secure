#!/usr/bin/env bash
# Read-only API diagnostic for the PQFile Secure Docker Compose stack.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then
  echo "Không tìm thấy docker. Hãy bật Docker Desktop." >&2
  exit 1
fi
if ! docker compose ps >/dev/null 2>&1; then
  echo "Không kết nối được Docker Compose tại thư mục dự án." >&2
  exit 1
fi
printf '\n=== Trạng thái dịch vụ ===\n'
docker compose ps
printf '\n=== Gateway /api/health ===\n'
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 10 -o /dev/null -w 'HTTP %{http_code} - %{time_total}s\n' http://localhost:8080/api/health || echo 'Không truy cập được API qua gateway.'
fi
printf '\n=== Lỗi API gần đây (không chứa request body) ===\n'
if [[ "${1:-}" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  docker compose logs --no-color --tail=3000 api 2>&1 | grep -F -A 12 -- "${1}" || echo 'Không tìm thấy mã lỗi trong log hiện tại.'
else
  docker compose logs --no-color --tail=1200 api 2>&1 | grep -E -A 8 '^api[^ ]*  \| \[PQFile API\] [0-9a-f-]{36}' | tail -n 130 || echo 'Chưa thấy lỗi API có mã truy vết trong log gần đây.'
fi
printf '\n=== Cảnh báo cấu hình HMAC ===\n'
docker compose logs --no-color --tail=350 api 2>&1 | grep -F 'SECURITY_HMAC_KEY missing' | tail -n 2 || echo 'Không thấy cảnh báo HMAC ở log gần đây.'
printf '\nLưu ý: trước khi chia sẻ log, hãy che thông tin nhạy cảm. Không chạy lệnh down -v.\n'
