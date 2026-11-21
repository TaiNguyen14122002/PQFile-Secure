#!/usr/bin/env bash
# Read-only checks; does not fetch documents, send credentials, or change volumes.
set -uo pipefail
BASE_URL="${1:-http://localhost:8080}"
case "$BASE_URL" in
  http://localhost:*|http://127.0.0.1:*) ;;
  *) echo 'Chỉ cho phép địa chỉ localhost khi chẩn đoán. Ví dụ: http://localhost:8080' >&2; exit 2;;
esac
BASE_URL="${BASE_URL%/}"
if ! command -v curl >/dev/null 2>&1; then echo 'Cần cài curl.' >&2; exit 1; fi
TMPDIR_PQ="$(mktemp -d)" || exit 1
trap 'rm -rf "$TMPDIR_PQ"' EXIT

printf '\n=== PQFile Secure: kiểm tra Gateway / API (không gửi mật khẩu) ===\n'
if command -v docker >/dev/null 2>&1 && [ -f docker-compose.yml ]; then
  printf '\n[Docker containers]\n'
  docker compose ps 2>&1 || true
  printf '\n[Kiểm tra cấu hình Nginx trong container]\n'
  docker compose exec -T gateway nginx -t 2>&1 || true
fi

check_api() {
  local label="$1" path="$2" expected="$3"
  local headers="$TMPDIR_PQ/headers" body="$TMPDIR_PQ/body" status mime route
  : >"$headers"; : >"$body"
  status="$(curl -sS --max-time 15 --max-redirs 0 -H 'Accept: application/json' \
    -D "$headers" -o "$body" -w '%{http_code}' "$BASE_URL$path" 2>"$TMPDIR_PQ/curl_err")" || status='000'
  mime="$(awk 'BEGIN{IGNORECASE=1} tolower($1)=="content-type:" {print $2}' "$headers" | tr -d '\r' | tail -1)"
  route="$(awk 'BEGIN{IGNORECASE=1} tolower($1)=="x-pqfile-route:" {print $2}' "$headers" | tr -d '\r' | tail -1)"
  printf '%-28s HTTP %-3s | %-27s | route=%s\n' "$label" "$status" "${mime:-missing}" "${route:-missing}"
  if [ "$status" = '000' ]; then
    echo '  Không kết nối được Gateway: kiểm tra cổng 8080, Docker và firewall.'
  elif ! printf '%s' "$mime" | grep -Eiq '(application/(json|[a-z0-9.+-]+\+json)|text/json)'; then
    echo '  CHÚ Ý: endpoint API không trả Content-Type JSON. Kiểm tra Nginx hoặc reverse proxy bên ngoài.'
  fi
  if [ "$status" != "$expected" ]; then
    printf '  Chờ HTTP %s; nhận HTTP %s. Xem nhật ký api/gateway.\n' "$expected" "$status"
  fi
}
check_api 'Health API' '/api/health' '200'
check_api 'Phiên chưa đăng nhập' '/api/auth/me' '401'
check_api 'Đường dẫn không tồn tại' '/api/__pqfile_json_probe__' '404'
check_api 'Không có slash cuối /api' '/api' '404'

printf '\n[Nếu API vẫn bị trả HTML]\n'
printf 'Chạy: docker compose logs --since=5m api gateway\n'
printf 'Sau đó mở Developer Tools → Network, xem Request URL, Status và Response Headers của yêu cầu lỗi.\n'
printf 'Không chia sẻ Cookie, Authorization, token hay phản hồi chứa dữ liệu cá nhân.\n'
