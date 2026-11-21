#!/usr/bin/env bash
# Lightweight unauthenticated smoke checks. Does NOT mutate PostgreSQL or RustFS.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:8080}"
if ! command -v curl >/dev/null 2>&1; then echo 'Cần cài curl.' >&2; exit 1; fi
check() {
  local endpoint="$1" expected="$2" status
  status="$(curl -sS --connect-timeout 6 --max-time 12 -o /dev/null -w '%{http_code}' "${BASE_URL}${endpoint}")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL ${endpoint}: HTTP ${status}, cần ${expected}" >&2
    exit 1
  fi
  echo "PASS ${endpoint}: HTTP ${status}"
}
check '/api/health' 200
check '/api/files/library' 401
check '/api/activity/paged' 401
check '/api/workspaces' 401
check '/api/dashboard/overview' 401
printf '\nĐã qua kiểm tra kết nối và bảo vệ API khi chưa đăng nhập.\n'
printf '%s\n' 'Vẫn cần chạy kiểm thử đăng nhập, tải tệp, giải mã và nhóm theo tài liệu docs/REFINEMENT_2026.md.'
