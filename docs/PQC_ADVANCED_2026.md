# PQFile Secure — 5 nhóm chức năng mật mã hậu lượng tử mở rộng (2026)

## Phạm vi và trạng thái

Nền tảng: Nuxt/Vue 3 + NestJS + PostgreSQL + RustFS + crypto-core; mã hóa nội dung và khóa riêng chỉ ở trình duyệt.

| Chức năng | Đã lập trình | Giới hạn thực tế |
| --- | --- | --- |
| ML-KEM + X25519 + HKDF | Chế độ HYBRID bọc CEK cho tệp mới, giữ PQC v1; thực nghiệm 3 chế độ và CSV (thời gian, handshake, ciphertext, chênh lệch JS heap nếu trình duyệt hỗ trợ) | Thử nghiệm triển khai, chưa phải giao thức được NIST chứng nhận hoặc nhóm TLS RFC 10024 |
| Xoay vòng khóa | Tạo KEM `PENDING`, sao lưu hai khóa đã mã hóa, tái bọc từng CEK và **giải thử** tại trình duyệt, kết thúc khi không còn envelope cũ | Xử lý theo lô 15 envelope trong giao dịch, có thể tiếp tục sau gián đoạn; không được mở nhiều tab thực hiện đồng thời; cần chạy kiểm thử Docker với tài liệu thật |
| Khôi phục 3/5 | Shamir GF(256), AES-GCM bọc vault, 5 mảnh riêng, ghép ≥3 mảnh, đổi mật khẩu và ký xác nhận | Phân phát/đối chiếu danh tính người giữ mảnh là quy trình thủ công; không thay thế khôi phục tài khoản đăng nhập |
| Danh bạ khóa tin cậy | Fingerprint SHA-256 ML-KEM và X25519, QR public, ghim theo người nhận, từ chối chia sẻ mới nếu khóa chưa ghim/đã thay đổi; nhật ký băm liên kết | Log nằm trên cùng máy chủ, **chưa neo ngoài hệ thống** nên chưa có bảo đảm chống server sửa lịch sử; xác minh fingerprint phải thực hiện qua kênh độc lập |
| Phiếu toàn vẹn | Ký ML-DSA-65 trên manifest + phiếu; chứng nhận JSON, xác minh trên trình duyệt hoặc CLI offline; tùy chọn so sánh SHA-256 ciphertext | Không là CA, không xác nhận nhân thân người ký, đồng hồ thiết bị không phải dấu thời gian đáng tin cậy. Không thể chứng minh hash của tệp bên ngoài khi không cung cấp ciphertext. |

**FIPS 203** quy định ML-KEM, **FIPS 204** quy định ML-DSA, **FIPS 205** quy định SLH-DSA; dự án chưa triển khai SLH-DSA. NIST IR 8547 (10/2026) tập trung chuyển đổi sang mật mã hậu lượng tử. Tham khảo tài liệu NIST và SP 800-227. Không tự tuyên bố hệ thống đã được chứng nhận FIPS 140-3.

## Triển khai an toàn (MacBook, Docker)

1. Sao lưu cả PostgreSQL **và** kho RustFS; thử trên bản nghiên cứu tách biệt, không chạy ngay trên kho chứa dữ liệu thật. Không chạy `docker compose down -v`.
2. Sao lưu `.env`, bản sao khóa được mã hóa và 5 mảnh nếu đã tạo; tuyệt đối không gửi mật khẩu hoặc mảnh vào chat/log.
3. Tại thư mục gốc dự án, áp dụng `git apply --check` rồi `git apply` file `PQFile_PQC_Advanced_5_Features_2026.patch`.
4. Chạy `docker compose up -d --build api web`; API thực thi migration cộng dồn `0000_initial.sql` lúc khởi động.
5. Kiểm tra `docker compose ps`; mở `http://localhost:8080/pqc`; làm mới cache trình duyệt.
6. Chạy kiểm thử `npm run test:pqc` sau khi cài dependencies. Kết quả ở môi trường nguồn chỉ là kiểm tra cục bộ, phải xác nhận vòng mã hóa/giải mã thật với browser + PostgreSQL + RustFS của bạn.

Ví dụ sao lưu PostgreSQL từ host (tệp chứa dữ liệu nhạy cảm, bảo vệ phân quyền):

```bash
mkdir -p ./db-backups
chmod 700 ./db-backups
docker compose exec -T postgres pg_dump -U pqfile -d pqfile -Fc > ./db-backups/pqfile-before-pqc.dump
chmod 600 ./db-backups/pqfile-before-pqc.dump
```

Đừng coi bản backup DB là đủ: phải sao lưu luôn RustFS (object ciphertext) và các vault backup đã mã hóa trước khi thay khóa.

## Kịch bản kiểm tra chức năng (khuyến nghị tài khoản Demo riêng)

### 1. Mã hóa lai

- Vào `/keys`, mở kho khóa; vào `/pqc?tab=hybrid` và kích hoạt X25519 nếu tài khoản cũ chưa có.
- Ở `/pqc`, nhập mẫu 1–512 KiB và chạy thử nghiệm 3 chế độ; xuất CSV.
- Vào `/upload`, chọn `Lai ML-KEM + X25519 + HKDF`, tải lên tệp nhỏ trước. Tải xuống/xem trước và kiểm tra nội dung không thay đổi.
- Khi chia sẻ, người nhận phải có X25519 được ghim bằng fingerprint ngoài băng. Đối với tệp lai, chia sẻ tiếp cũng phải giữ chế độ lai.

### 2. Xoay khóa

- Sao lưu kho khóa và các tệp Demo; truy cập `/pqc?tab=rotation`, nhập mật khẩu kho khóa.
- Tạo khóa mới. Dự án giữ bộ khóa KEM cũ `ACTIVE`, bộ khóa mới `PENDING`, DSA không đổi.
- Bấm **Tái bọc và xác minh**. Mỗi CEK được giải bọc với khóa cũ và bọc lại bằng khóa mới; hệ thống giải thử và so sánh CEK rồi mới POST envelope mới.
- Không đóng trình duyệt khi một tệp đang xử lý; nếu bị gián đoạn, mở lại vault (bản đã sao lưu chứa khóa `pendingKem`) và tiếp tục.
- **Hoàn tất** chỉ được phép khi API không còn envelope sử dụng khóa cũ. Recovery 3/5 cũ được vô hiệu hóa vì chứa khóa lỗi thời: tạo lại kế hoạch khôi phục 3/5.
- So sánh SHA-256 ciphertext trước/sau xoay (không thay đổi) và thử giải mã tệp ở nhiều định dạng.

### 3. Khôi phục 3/5

- Vào `/pqc?tab=recovery`, mở vault, tạo 5 mảnh độc lập.
- Tải/lưu mỗi mảnh riêng cho 5 người giữ; bản mã khôi phục được lưu tại server. Không gửi cả năm mảnh cùng nhau.
- Dùng 3 mảnh khác nhau bất kỳ, bấm ghép để kiểm tra, đặt mật khẩu mới; thao tác thay bản sao lưu được ký bởi ML-DSA.
- Trường hợp còn quyền đăng nhập nhưng mất mật khẩu kho khóa vẫn dùng được; **không** phục hồi được tài khoản đăng nhập nếu đã mất quyền xác thực.

### 4. Xác minh khóa nhận

- `/pqc?tab=trust`: tìm email, xem ML-KEM fingerprint và X25519 fingerprint (nếu có), mã QR chỉ chứa thông tin công khai.
- Đối chiếu cả hai fingerprint bằng điện thoại/gặp trực tiếp/kênh khác độc lập với PQFile, xác nhận checkbox, ký ghim khóa.
- Sau khi người nhận xoay khóa, trạng thái chuyển thành `KEY_CHANGED`: buộc xác minh lại trước khi cấp quyền mới.
- Nhật ký hash-chain chỉ là cơ chế truy vết phía máy chủ, chưa hỗ trợ Merkle proof/neo độc lập để đối phó server gian lận.

### 5. Phiếu toàn vẹn

- `/pqc?tab=receipt`: chọn tệp đang sở hữu, mở vault, ký phiếu JSON, tải về.
- Xác minh trên trình duyệt mà không cần giải mã tệp; nếu có ciphertext, chọn thêm tệp để kiểm tra hash.
- Từ máy có Node và dependency dự án: `node scripts/verify-pqfile-receipt.mjs receipt.json path/to/file.ciphertext`.
- Phiếu hợp lệ chứng minh sở hữu khóa ký phù hợp; muốn gắn danh tính thực cần kiểm tra fingerprint độc lập và nguồn CA/phần chứng thực bên ngoài.

## Nâng cấp DB (chỉ bổ sung, không phá dữ liệu V1/V2)

- `file_recipients.hybrid_ephemeral_public`, `file_recipients.hybrid_salt`: nullable, tệp cũ = NULL.
- `user_keys`: thêm bản ghi X25519 (không phải cột mới), khóa ML-KEM được phép PENDING/RETIRED.
- `pqc_trusted_recipient_keys`: ghim khóa người nhận, cặp khóa X25519.
- `pqc_recovery_plans`: chỉ lưu payload khôi phục đã mã hóa.
- `pqc_key_history`: chuỗi hash-chain băm khóa công khai và sự kiện; sequence để sắp thứ tự chắc chắn.

Không có migration xóa tài khoản hoặc ciphertext. Khóa kho và mật khẩu không được gửi dạng rõ lên API.

## Giới hạn và an toàn nghiên cứu

- Đây là bản **prototype nghiên cứu**; không được tuyên bố an toàn sản xuất hoặc chứng nhận NIST/FIPS. Cần kiểm thử end-to-end, mã hóa đe dọa, kiểm toán mã mật mã, bài kiểm thử xử lý mất điện và quản lý khóa trước khi dùng dữ liệu nhạy cảm thực tế.
- Thao tác xoay khóa dựa trên xác minh tại **thiết bị của chủ khóa**. API ghi nhận chữ ký ML-DSA bảo vệ yêu cầu, không trực tiếp thấy CEK, không tự chứng minh được người dùng đã giải thử đúng CEK.
- Việc đổi khóa không thu hồi bản đã tải/giải mã hoặc giải quyết sự cố đã rò rỉ trước đó.
- Máy chủ vẫn thấy metadata, danh tính, thời điểm, kích thước và tương quan quyền truy cập; cơ chế này không được quảng cáo là ẩn metadata.
- Luồng minh bạch khóa dạng hash-chain không có chứng thực bởi nhân chứng bên thứ ba nên chỉ có tính kiểm tra nội bộ.
- NIST hybrid guidance SP 800-227 và TLS RFC 10024 có phạm vi khác nhau; bộ kết hợp HKDF dùng miền riêng của PQFile không phải gói giao thức TLS tương thích.

### Tài liệu tham khảo

- https://csrc.nist.gov/pubs/fips/203/final
- https://csrc.nist.gov/pubs/fips/204/final
- https://csrc.nist.gov/pubs/fips/205/final
- https://csrc.nist.gov/pubs/sp/800/227/final
- https://csrc.nist.gov/Projects/Post-Quantum-Cryptography
- https://www.rfc-editor.org/rfc/rfc10024.html
