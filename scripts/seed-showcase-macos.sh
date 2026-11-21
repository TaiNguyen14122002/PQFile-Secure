#!/usr/bin/env bash
# Adds demo.showcase@pqfile.local + genuine encrypted synthetic files to LOCAL research database.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != Darwin ]; then echo 'Cần chạy trên macOS có Keychain.' >&2; exit 1; fi
if ! command -v docker >/dev/null 2>&1; then echo 'Thiếu Docker Desktop.' >&2; exit 1; fi
if [ ! -f .env ]; then echo 'Không tìm thấy .env của dự án.' >&2; exit 1; fi
printf '\n%s\n' 'TẠO TÀI KHOẢN DEMO RIÊNG: demo.showcase@pqfile.local'
printf '%s\n' 'Nạp 120 tệp đã mã hóa, 66 lượt chia sẻ, 6 nhóm, 253 nhật ký, 36 sự kiện an ninh.'
printf '%s\n' 'Chỉ chạy trên hệ thống thử nghiệm RIÊNG BIỆT; không chạy production.'
printf '%s\n' 'Dữ liệu V1/V2 hiện có được giữ nguyên. Hãy sao lưu trước khi chạy.'
read -r -p 'Xác nhận đúng môi trường nghiên cứu (nhập SHOWCASE): ' CONFIRM
if [ "$CONFIRM" != SHOWCASE ]; then echo 'Đã hủy.'; exit 1; fi
source scripts/lib/seed-research-keychain.sh
source scripts/lib/seed-showcase-keychain.sh
pq_seed_keychain_load existing
pq_showcase_keychain_load create
cleanup() { unset DEMO_PASSWORD DEMO_VAULT_PASSWORD DEMO_SHOWCASE_PASSWORD DEMO_SHOWCASE_VAULT_PASSWORD; }
trap cleanup EXIT
if docker compose exec -T -e DEMO_SHOWCASE_ENABLED=yes -e DEMO_DATASET_CONFIRM=SHOWCASE_ONLY \
    -e DEMO_VAULT_PASSWORD -e DEMO_SHOWCASE_PASSWORD -e DEMO_SHOWCASE_VAULT_PASSWORD \
    api npm run seed:showcase -w @pqfile/api; then
  printf '\n%s\n' 'Đã chạy seed. Tài khoản: demo.showcase@pqfile.local'
  printf '%s\n' 'Mở khóa trên máy Mac: bash scripts/show-showcase-credentials-macos.sh'
else
  printf '\n%s\n' 'Seed chưa hoàn thành. Không cần nạp lại V1/V2; xem lỗi phía trên.' >&2
  exit 1
fi
