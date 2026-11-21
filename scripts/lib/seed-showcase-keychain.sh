#!/usr/bin/env bash
# Source after seed-research-keychain.sh. Strong distinct credentials for showcase account.
# These are separate from V1/V2 credentials and never written to .env or project files.
pq_showcase_keychain_load() {
  local policy="${1:-existing}"
  pq_seed_keychain_service || return 1
  local service="${PQ_SEED_KEYCHAIN_SERVICE}-showcase"
  local login='' vault='' login_found=no vault_found=no
  if login="$(security find-generic-password -s "$service" -a showcase-login -w 2>/dev/null)"; then login_found=yes; fi
  if vault="$(security find-generic-password -s "$service" -a showcase-vault -w 2>/dev/null)"; then vault_found=yes; fi
  if [ "$login_found" != "$vault_found" ]; then
    echo 'Keychain lưu thiếu một mật khẩu demo showcase; đã dừng.' >&2; return 1
  fi
  if [ "$login_found" = no ]; then
    if [ "$policy" != create ]; then
      echo 'Chưa có mật khẩu demo showcase trong Keychain. Hãy chạy seed-showcase-macos.sh trước.' >&2; return 1
    fi
    login="$(openssl rand -hex 32)" || return 1
    vault="$(openssl rand -hex 32)" || return 1
    if ! security add-generic-password -s "$service" -a showcase-login \
      -l 'PQFile showcase login' -w "$login" >/dev/null; then
      echo 'Lưu mật khẩu demo showcase vào Keychain thất bại.' >&2; return 1
    fi
    if ! security add-generic-password -s "$service" -a showcase-vault \
      -l 'PQFile showcase vault' -w "$vault" >/dev/null; then
      security delete-generic-password -s "$service" -a showcase-login >/dev/null 2>&1 || true
      echo 'Lưu mật khẩu kho khóa demo vào Keychain thất bại.' >&2; return 1
    fi
    echo 'Đã tạo mật khẩu riêng cho tài khoản demo showcase trong Keychain.'
  fi
  if [ "${#login}" -lt 14 ] || [ "${#vault}" -lt 14 ] || [ "$login" = "$vault" ]; then
    echo 'Mật khẩu showcase không đạt yêu cầu hoặc giống nhau.' >&2; return 1
  fi
  DEMO_SHOWCASE_PASSWORD="$login"
  DEMO_SHOWCASE_VAULT_PASSWORD="$vault"
  export DEMO_SHOWCASE_PASSWORD DEMO_SHOWCASE_VAULT_PASSWORD
  unset login vault
}
