# Tiến độ triển khai theo đặc tả Phần I–VIII

**Phiên bản nâng cấp trong ZIP: 0.2.0 MVP (bản nghiên cứu, không có bảo đảm an ninh production).**

Cải tiến chi tiết xem [CHANGELOG_0.2.0.md](./CHANGELOG_0.2.0.md).

| Đặc tả | Trạng thái MVP | Ghi chú |
|---|---|---|
| FR-01, FR-02 | Một phần | Đăng ký, đăng nhập, cookie session; chưa email verify/MFA/thu hồi phiên |
| FR-03, FR-04 | Chưa | Quên mật khẩu, hồ sơ, xóa tài khoản |
| FR-05–FR-07 | Một phần | Có role USER, SYSTEM_ADMIN và owner/share check, chưa RBAC policy engine |
| FR-08–FR-10 | Một phần | Tạo và bảo vệ ML-KEM/ML-DSA, chưa rotation |
| FR-11–FR-13 | Một phần | Xuất backup mã hóa, mở backup server, chưa nhập backup tệp/verify trust |
| FR-14 | Đã có MVP | Multi-select, kéo thả, giới hạn 20 MiB |
| FR-15, FR-16 | Đã có MVP | KEM/HKDF/AES-GCM/ML-DSA client-side và upload ciphertext |
| FR-17 | Một phần | Xử lý tuần tự từng tệp, chưa có worker/chunk/resume |
| FR-18, FR-19 | Đã có MVP | Download ciphertext, verify ML-DSA + checksum và decrypt client-side |
| FR-20 | Một phần | Fail closed khi sai ciphertext/chữ ký/khóa; chưa fuzzing |
| FR-21–FR-23 | Một phần | Danh sách, đổi nhãn, thùng rác/khôi phục/xóa vĩnh viễn; chưa thư mục/revision |
| FR-24, FR-25 | Đã có MVP | Tạo envelope cho người nhận; nhiều người nhận khi upload |
| FR-26 | Một phần | UI + API thu hồi, cấp lại quyền chia sẻ; policy file còn đơn giản |
| FR-27 | Chưa | Secure share link |
| FR-28, FR-29 | Đã có MVP | Ký manifest và verify ML-DSA 65 phía trình duyệt |
| FR-30 | Một phần | Tạo workspace, thêm/xóa thành viên và sửa vai trò; chưa workspace files |
| FR-31 | Chưa | File/folder của workspace |
| FR-32 | Chưa | Email, thông báo, hàng đợi worker |
| FR-33 | Một phần | Lịch sử upload và share |
| FR-34–FR-37 | Rất hạn chế | API admin users có guard, chưa admin dashboard/audit đầy đủ |

## Vì sao chưa gắn nhãn “production secure”?

Đặc tả yêu cầu chống IDOR/BOLA hoàn chỉnh, kiểm toán, quản lý khóa dài hạn, luồng PQF chunk streaming, backup/restore, dữ liệu lớn, MFA và kiểm thử. MVP hiện mới triển khai phần khả thi để thực nghiệm đường đi dữ liệu. Một tệp 20 MiB đang được mã hóa một lần trong bộ nhớ JS và ciphertext lưu raw + manifest/recipient envelope trong PostgreSQL; chưa sử dụng Web Worker hoặc định dạng `.pqf` record hoàn chỉnh.

## Lộ trình tiếp theo

1. Chuẩn hóa `.pqf` records v1: chunk nonce, AAD, final record, xử lý tập tin lớn trong worker, kiểm thử NIST KAT.
2. Phân quyền schema RBAC/Resource-based hoàn chỉnh, tests IDOR, session revocation/MFA, CSRF, rate-limit nâng cao.
3. Quản lý khóa vòng đời, key trust, verification fingerprints, rotated/retired keys và file backup import.
4. File lifecycle, thư mục, phiên bản, share links, thu hồi grant và workspace permissions.
5. Email/Redis BullMQ, admin/audit, metrics/backup/restore, hardening, kiểm định an ninh.
