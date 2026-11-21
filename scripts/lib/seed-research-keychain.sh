#!/usr/bin/env bash
# Sourced by PQFile research-only seed scripts. Mac login Keychain protects
# generated secrets; there are no default passwords or plaintext secret files.
# Called after changing to the project root.

pq_seed_keychain_service() {
  if [ "$(uname -s)" != 'Darwin' ] || ! command -v security >/dev/null 2>&1; then
    echo 'Chế độ không hỏi mật khẩu yêu cầu macOS Keychain.' >&2
    return 1
  fi
  if ! command -v openssl >/dev/null 2>&1 || ! command -v shasum >/dev/null 2>&1; then
    echo 'Thiếu openssl hoặc shasum trên máy Mac.' >&2
    return 1
  fi
  # Namespaced by physical project path to avoid reusing credentials for another instance.
  local identifier
  identifier="$(pwd -P | shasum -a 256 | cut -c1-20)"
  PQ_SEED_KEYCHAIN_SERVICE="pqfile-secure-research-${identifier}"
}

pq_seed_keychain_load() {
  local policy="${1:-existing}" # create for V1; existing for V2/show
  pq_seed_keychain_service || return 1
  local login='' vault='' login_found=no vault_found=no
  if login="$(security find-generic-password -s "$PQ_SEED_KEYCHAIN_SERVICE" -a research-login -w 2>/dev/null)"; then
    login_found=yes
  fi
  if vault="$(security find-generic-password -s "$PQ_SEED_KEYCHAIN_SERVICE" -a research-vault -w 2>/dev/null)"; then
    vault_found=yes
  fi
  if [ "$login_found" != "$vault_found" ]; then
    echo 'Keychain chỉ có một trong hai mật khẩu nghiên cứu. Đã dừng để tránh làm mất khả năng giải mã.' >&2
    return 1
  fi
  if [ "$login_found" = no ]; then
    if [ "$policy" != create ]; then
      echo 'Chưa tìm thấy mật khẩu V1 trong Keychain. Hãy nạp V1 bằng script tự động trước.' >&2
      return 1
    fi
    login="$(openssl rand -hex 32)" || return 1
    vault="$(openssl rand -hex 32)" || return 1
    # Never write these secrets to a project file, .env, stdout or logs.
    if ! security add-generic-password -s "$PQ_SEED_KEYCHAIN_SERVICE" -a research-login -l 'PQFile research demo login' -w "$login" >/dev/null; then
      echo 'Không lưu được mật khẩu đăng nhập vào macOS Keychain.' >&2
      return 1
    fi
    if ! security add-generic-password -s "$PQ_SEED_KEYCHAIN_SERVICE" -a research-vault -l 'PQFile research demo vault' -w "$vault" >/dev/null; then
      security delete-generic-password -s "$PQ_SEED_KEYCHAIN_SERVICE" -a research-login >/dev/null 2>&1 || true
      echo 'Không lưu được mật khẩu kho khóa vào macOS Keychain.' >&2
      return 1
    fi
    printf '%s\n' 'Đã sinh và lưu hai mật khẩu nghiên cứu khác nhau trong macOS Keychain.'
  else
    printf '%s\n' 'Đã nạp lại mật khẩu nghiên cứu từ macOS Keychain.'
  fi
  if [ "${#login}" -lt 14 ] || [ "${#vault}" -lt 14 ] || [ "$login" = "$vault" ]; then
    echo 'Thông tin Keychain không hợp lệ (cần hai mật khẩu khác nhau, >=14 ký tự).' >&2
    return 1
  fi
  DEMO_PASSWORD="$login"
  DEMO_VAULT_PASSWORD="$vault"
  export DEMO_PASSWORD DEMO_VAULT_PASSWORD
  unset login vault
}
