#!/usr/bin/env bash
# Add V2 synthetic dataset using the SAME vault password saved by the V1 seed.
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null 2>&1; then echo 'Cần Docker Desktop.' >&2; exit 1; fi
if [ ! -f .env ]; then echo 'Thiếu .env trong thư mục dự án.' >&2; exit 1; fi
printf '\n%s\n' 'PQFile Secure – bộ dữ liệu nghiên cứu V2 (chỉ giả lập)'
printf '%s\n' 'Thêm 144 tệp mã hóa, 176 lượt chia sẻ, 1115 hoạt động và 180 sự kiện an ninh.'
printf '%s\n' 'YÊU CẦU: đã chạy bộ dữ liệu gốc V1 và sao lưu dữ liệu trước khi tiếp tục.'
printf '%s\n' 'KHÔNG chạy trên hệ thống có dữ liệu người dùng thật hoặc production.'
read -r -p 'Xác nhận hệ thống NGHIÊN CỨU RIÊNG BIỆT (nhập RESEARCH_ONLY): ' CONFIRM
if [ "$CONFIRM" != 'RESEARCH_ONLY' ]; then echo 'Đã hủy.'; exit 1; fi
source scripts/lib/seed-research-keychain.sh
pq_seed_keychain_load existing
cleanup() { unset DEMO_PASSWORD DEMO_VAULT_PASSWORD; }
trap cleanup EXIT
# Values are inherited from the calling environment via -e NAME; never passed as argv values.
if docker compose exec -T -e DEMO_REALISTIC_ENABLED=yes -e DEMO_DATASET_CONFIRM=RESEARCH_ONLY -e DEMO_VAULT_PASSWORD \
  api npm run seed:realistic -w @pqfile/api; then
  printf '\n%s\n' 'Đã hoàn tất. Đăng nhập demo.admin@pqfile.local để kiểm tra Dashboard, An ninh và Quản trị quyền.'
else
  printf '\n%s\n' 'Nạp dữ liệu chưa hoàn tất. Xem lỗi phía trên; bản seed có thể chạy lại với cùng mật khẩu Keychain.' >&2
  exit 1
fi
