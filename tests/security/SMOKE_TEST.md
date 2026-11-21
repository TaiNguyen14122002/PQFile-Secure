# Kiểm thử bảo mật thủ công cho bản MVP

1. Khi chưa đăng nhập: GET `/api/files`, GET `/api/keys`, GET `/api/admin/users` phải từ chối (401).
2. Dùng tài khoản USER: GET `/api/admin/users` phải từ chối (403).
3. Dùng hai tài khoản đã tạo khóa riêng biệt: Người B không được GET `/api/files/{id}` hoặc `/api/files/{id}/blob` của A khi chưa được A chia sẻ.
4. A tạo recipient envelope cho B và chia sẻ. B được tải ciphertext, nhưng không thể dùng khóa của A để giải mã.
5. A thu hồi chia sẻ, sau đó B không được tải ciphertext mới. Việc thu hồi không xóa bản đã tải xuống.
6. Sửa một byte ciphertext, chữ ký manifest hoặc dùng sai khóa: không xuất plaintext.
7. Đổi `fileId` trong URL và gửi request từ user khác: không được lộ metadata hay ciphertext.
8. Không bao giờ xuất hiện private key, plaintext, passphrase vault trong payload API, log hoặc DB.
9. Chạy `npm run test:crypto` để kiểm tra ML-KEM 512/768/1024 và các trường hợp bị sửa đổi.

**Chưa có:** tự động hóa toàn bộ security/e2e, kiểm định độc lập, fuzzing, pentest, MFA, RLS, CSP hoàn chỉnh.
