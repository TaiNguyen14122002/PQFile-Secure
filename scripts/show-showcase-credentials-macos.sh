#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf '%s\n' 'Cảnh báo: lệnh tiếp theo hiển thị mật khẩu tài khoản demo trên Terminal.'
read -r -p 'Bạn ở nơi riêng tư, muốn xem mật khẩu? Nhập SHOW: ' CONFIRM
if [ "$CONFIRM" != SHOW ]; then echo 'Đã hủy.'; exit 1; fi
source scripts/lib/seed-research-keychain.sh
source scripts/lib/seed-showcase-keychain.sh
pq_showcase_keychain_load existing
printf '\nEmail: %s\n' 'demo.showcase@pqfile.local'
printf 'Mật khẩu đăng nhập: %s\n' "$DEMO_SHOWCASE_PASSWORD"
printf 'Mật khẩu kho khóa: %s\n' "$DEMO_SHOWCASE_VAULT_PASSWORD"
printf '%s\n' 'Không gửi hai mật khẩu vào hội thoại hoặc chụp ảnh màn hình.'
unset DEMO_SHOWCASE_PASSWORD DEMO_SHOWCASE_VAULT_PASSWORD
