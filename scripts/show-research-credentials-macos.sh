#!/usr/bin/env bash
# Explicit local display only; never send credentials to a chat or ticket.
set -euo pipefail
cd "$(dirname "$0")/.."
printf '%s\n' 'Cảnh báo: thông tin mật khẩu sẽ hiển thị trên màn hình Terminal.'
read -r -p 'Bạn đang ở nơi riêng tư và muốn xem? Nhập SHOW: ' CONSENT
if [ "$CONSENT" != SHOW ]; then echo 'Đã hủy.'; exit 1; fi
source scripts/lib/seed-research-keychain.sh
pq_seed_keychain_load existing
printf '\nEmail: %s\nMật khẩu đăng nhập: %s\nMật khẩu kho khóa: %s\n' \
  'demo.admin@pqfile.local' "$DEMO_PASSWORD" "$DEMO_VAULT_PASSWORD"
unset DEMO_PASSWORD DEMO_VAULT_PASSWORD
printf '\n%s\n' 'Không chụp/đăng ảnh màn hình hoặc chia sẻ các mật khẩu này.'
