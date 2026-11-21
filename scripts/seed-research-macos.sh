#!/usr/bin/env bash
# Load/generated secure research credentials from the macOS login Keychain.
# Run explicitly on a LOCAL isolated PQFile Secure deployment only.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then echo 'Docker Desktop chưa được cài đặt.' >&2; exit 1; fi
if [ ! -f .env ]; then echo 'Chưa có .env. Sao chép .env.example và điền thông tin kết nối trước.' >&2; exit 1; fi
printf '%s\n' 'LƯU Ý: Lệnh này ghi 1.290 tệp nghiên cứu vào PostgreSQL + kho ciphertext.'
printf '%s\n' 'Chỉ dùng trên hệ thống nghiên cứu tách biệt; không chạy trên production.'
read -r -p 'Xác nhận bạn đang dùng môi trường thử nghiệm riêng (nhập SEED): ' CONSENT
if [ "$CONSENT" != 'SEED' ]; then echo 'Đã hủy.'; exit 1; fi
source scripts/lib/seed-research-keychain.sh
pq_seed_keychain_load create
# Passing names rather than values avoids exposing secrets in docker command arguments.
# Cleanup still runs on failure; never echo secrets.
cleanup() { unset DEMO_PASSWORD DEMO_VAULT_PASSWORD; }
trap cleanup EXIT
docker compose exec -T -e DEMO_SEED_ENABLED=yes -e DEMO_PASSWORD -e DEMO_VAULT_PASSWORD \
  api npm run seed:research -w @pqfile/api
printf '\n%s\n' 'Đã kết thúc seed. Tài khoản: demo.admin@pqfile.local'
printf '%s\n' 'Để xem hai mật khẩu đã tạo (chỉ trên máy Mac của bạn): bash scripts/show-research-credentials-macos.sh'
