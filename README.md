# PQFile Secure — Docker + Nuxt 4 + NestJS + Tailwind CSS 4

Phiên bản **0.2.0 MVP nâng cấp** có tích hợp luồng bảo vệ tệp từ giao diện đến máy chủ, thiết kế dựa trên ảnh giao diện người dùng gửi và `docs/SPECIFICATION.md` (Phần I–VIII). Đây **chưa phải** bản hoàn thành toàn bộ 37 FR hoặc sản phẩm được kiểm toán bảo mật.

**Bổ sung 5 chức năng phân tích bảo mật (ngày 21/11/2026):** đánh giá rủi ro chia sẻ, Naive Bayes cục bộ phân loại tài liệu, phát hiện hành vi bất thường theo ngưỡng, đề xuất và benchmark ML-KEM, nhận diện/che PII trên bản sao. Xem [docs/SECURITY_INTELLIGENCE_2026.md](docs/SECURITY_INTELLIGENCE_2026.md) để biết phạm vi thật và giới hạn PDF/OCR/AI.

**Các cải tiến mới:** bộ lọc và phân trang tệp, thùng rác/khôi phục/xóa vĩnh viễn, đổi nhãn, quản lý chia sẻ và thu hồi, nhập backup từ thiết bị (kiểm tra tương thích), quản lý thành viên nhóm. Xem [docs/CHANGELOG_0.2.0.md](docs/CHANGELOG_0.2.0.md).

**Bộ dữ liệu nghiên cứu đã mã hóa thật:** có thể nạp 1.290 tệp mẫu (1.248 đang hoạt động, 42 trong thùng rác), 367 lượt chia sẻ, 12 nhóm và 720 bản ghi lịch sử vào PostgreSQL + RustFS bằng lệnh thủ công. Dữ liệu tạo ra có ciphertext, chữ ký và envelope mật mã dùng được; chi tiết tại [docs/RESEARCH_DATASET_AND_BACKGROUND.md](docs/RESEARCH_DATASET_AND_BACKGROUND.md).

**Bản hoàn thiện giao diện và nghiệp vụ tháng 11/2026:** cải thiện menu, đăng nhập/đăng ký, màn hình khóa và nhóm, tối ưu tải dữ liệu thư viện lớn, lọc lịch sử toàn DB, quản lý đổi tên/xóa nhóm, kiểm soát phân quyền thành viên, chia sẻ lại tệp. Xem [docs/REFINEMENT_2026.md](docs/REFINEMENT_2026.md) và chạy `bash scripts/smoke-refinement.sh` sau khi Docker đã khởi động.

**Lưu ý:** tệp `.env` không nằm trong ZIP đã chỉnh sửa; hãy chuyển `.env` riêng của bạn từ bản cũ hoặc tạo từ `.env.example`.

## 1. Stack

| Lớp | Công nghệ |
| --- | --- |
| Web | Nuxt 4, Vue 3, TypeScript, Tailwind CSS v4, Lucide |
| API | NestJS, TypeScript, REST, Swagger |
| DB | PostgreSQL 17, Drizzle ORM |
| Object storage | RustFS 1.0.3 (S3-compatible) |
| Redis | Redis 7.4 (sẵn cho hàng đợi, chưa có worker chạy thực tế) |
| Mật mã phía trình duyệt | `@noble/post-quantum` ML-KEM 512/768/1024, ML-DSA-65; WebCrypto AES-256-GCM + HKDF-SHA-256; `hash-wasm` Argon2id |
| Docker | Docker Compose, Nginx gateway, private service network |

**Lưu trữ:** dùng RustFS thay cho ảnh Docker Hub `minio/minio` đã bị rút khỏi public registry trong năm 2026. RustFS vẫn cung cấp API S3-compatible, phù hợp với đặc tả công nghệ.

## 2. Chạy trên Docker

Cài Docker Desktop (Mac/Windows) hoặc Docker Engine + Compose plugin (Linux).

```bash
cd pqfile-secure
cp .env.example .env
```

**Bắt buộc:** mở `.env` và đổi `POSTGRES_PASSWORD`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` thành chuỗi mạnh, KHÔNG commit `.env` lên Git.

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Mở trình duyệt: **http://localhost:8080**.

Lần chạy đầu: API dùng script khởi tạo schema `database/migrations/0000_initial.sql` theo cơ chế `CREATE TABLE IF NOT EXISTS`; không gọi `drizzle-kit push` không tương tác mỗi lần khởi động nữa. Script này tạo các bảng còn thiếu và chỉ bổ sung cột `files.source_type` theo migration tương thích ngược, không xóa dữ liệu cũ. Với hệ thống đã có dữ liệu, cần thực hiện các migration được xem xét cẩn thận. Dữ liệu nằm trên Docker named volumes nên tồn tại sau khi `docker compose down`.

Nếu API báo `Internal server error`, chạy `docker compose ps`, `docker compose logs --tail=150 api` và `curl -i http://localhost:8080/api/health`. Xem thêm `docs/HTTP_500_TROUBLESHOOTING.md`.

Dừng: `docker compose down`. **Không chạy** `docker compose down -v` trừ khi muốn xóa cả DB và ciphertext.

Nếu cổng 8080 bận, đổi thành `8081:80` trong `docker-compose.yml` **và** sửa `PUBLIC_BASE_URL=http://localhost:8081` trong `.env` để Origin protection không từ chối request.

### Quy trình kiểm thử sử dụng

1. Truy cập `/register`, đăng ký tài khoản với mật khẩu đăng nhập đủ 12 ký tự.
2. Vào **Khóa mật mã**, chọn ML-KEM-768, nhập mật khẩu *bảo vệ kho khóa* riêng (tối thiểu 12 ký tự), bấm **Tạo và bảo vệ bộ khóa**.
3. Tải tệp sao lưu đã mã hóa. Dùng chức năng **Khóa kho khóa**, rồi **Mở kho khóa** để kiểm tra khôi phục.
4. Vào **Tải lên** (`/upload`), kéo thả file PDF/DOCX/PNG... chọn **Chỉ tôi**, bấm **Mã hóa và tải lên**.
5. Vào **Tệp tin**, bấm biểu tượng tải xuống để xác minh chữ ký ML-DSA, checksum, giải mã AES-GCM và lưu bản rõ **trên máy của bạn**.
6. Muốn chia sẻ: tạo tài khoản thứ hai, tạo khóa thứ hai, ở tài khoản đầu tiên bấm **Chia sẻ** trên một tệp, tra cứu email người nhận và xác minh fingerprint. Sau khi cấp quyền, đăng nhập tài khoản hai và mở kho khóa để tải xuống.

**Lưu ý:** sau khi F5 hoặc đóng tab, kho khóa bị khóa (private key chỉ sống trong RAM) và cần mở lại bằng mật khẩu. Không có mật khẩu demo hoặc private key cứng trong mã nguồn. Tài khoản nghiên cứu chỉ được tạo khi quản trị viên chủ động chạy seed.

## 3. Chức năng đã có trong MVP

- Giao diện theo screenshot: nav ngang, hero ảnh trường học được cắt từ ảnh người dùng cung cấp, kéo thả nhiều tệp, bảng chọn ML-KEM/thuật toán/người nhận, danh sách tệp được chọn, thông báo kết quả, responsive.
- Đăng ký và đăng nhập bằng mật khẩu hash Argon2id; session token ngẫu nhiên, hash trong DB, cookie HttpOnly/SameSite=Strict.
- Sinh cặp khóa ML-KEM 512/768/1024 và ML-DSA-65 tại trình duyệt; lưu public keys + backup vault **đã mã hóa** trên server.
- Kho khóa được bảo vệ bằng Argon2id + AES-256-GCM; tải bản backup đã mã hóa; mở/khóa kho khóa cục bộ.
- Encrypt phía client, phát sinh CEK mỗi tệp, AES-256-GCM, bọc CEK bằng ML-KEM + HKDF cho người nhận; chữ ký ML-DSA của manifest.
- Upload ciphertext tới S3-compatible, metadata + quyền vào PostgreSQL, kiểm tra checksum ở API.
- Liệt kê tệp cá nhân/được chia sẻ; tải ciphertext và chỉ xuất tệp gốc khi xác minh manifest/chữ ký và giải mã thành công.
- Tìm kiếm người nhận theo email, tạo envelope và chia sẻ sau khi chủ sở hữu mở khóa, thu hồi/cấp lại quyền truy cập server ngay trên giao diện.
- Tạo nhóm làm việc cơ bản, thêm/xóa thành viên, chỉnh vai trò nhóm, lịch sử hoạt động và API admin users có kiểm tra vai trò.
- REST API, giới hạn kích thước upload, chặn Origin khác đối với browser writes, throttle, Nginx reverse proxy, private DB/Redis/storage.

## 4. CHƯA triển khai — bắt buộc trước production

- Xác minh email, MFA, thay đổi/khôi phục mật khẩu đăng nhập, quản lý và thu hồi từng phiên, chống brute-force theo user/email, kiểm tra email chuẩn hóa sâu.
- Role/permission tables và phân quyền RBAC hoàn chỉnh cho Support/Auditor/Admin; quyền file/folder/workspace đầy đủ, áp dụng `RLS` ở DB.
- Thư mục, bản sửa đổi tệp, tìm kiếm theo nội dung rõ, chia sẻ link, lời mời qua email và thông báo thời gian thực. Đã có thùng rác/khôi phục và lọc theo nhãn.
- Quản lý vòng đời khóa, xoay/thu hồi khóa kèm tái bọc CEK, quy trình xác minh danh tính public key và danh bạ khóa tin cậy, attestations. Nhập bản sao lưu đã mã hóa từ tệp có trong MVP nhưng chưa thay thế cơ chế khôi phục đầy đủ.
- **Chuẩn `.pqf` chính thức** gồm chunk records, final record, streaming qua Web Worker, tệp lớn, AAD cho toàn bộ metadata/recipients; phiên bản MVP hiện lưu ciphertext đơn khối và manifest ở DB, giới hạn **20 MiB/tệp**.
- Audit log bất biến, BullMQ worker, monitoring Prometheus/Grafana, backup/restore DB/S3, e2e, bảo mật hệ thống và đánh giá chuẩn NIST.
- Chưa có crypto/protocol audit độc lập. Không đưa dữ liệu nhạy cảm thật lên dịch vụ công khai dựa trên MVP này.

## 5. Cấu trúc thư mục

```
pqfile-secure/
├── apps/
│   ├── web/                   # Nuxt 4 + Vue 3 + Tailwind v4
│   ├── api/                   # NestJS REST + Drizzle
│   └── worker/                # placeholder BullMQ
├── packages/
│   ├── crypto-core/           # ML-KEM, ML-DSA, AES-GCM, HKDF, Argon2id
│   ├── file-format/           # placeholder chuẩn PQF v2
│   ├── key-vault/             # placeholder tách package
│   ├── shared-types/          # placeholder chia sẻ kiểu
│   ├── shared-validation/     # placeholder validate
│   ├── ui/                    # placeholder shared UI
│   ├── api-client/            # placeholder typed API client
│   └── authorization/         # placeholder policy engine
├── database/                  # schema tham chiếu, migration, seed, RLS policies
├── infrastructure/            # compose, nginx, backup, monitoring
├── tests/                     # unit crypto + checklist
├── docs/                      # file đặc tả gốc + screenshot
├── docker-compose.yml
└── .env.example
```

**Ghi chú:** schema Drizzle có thể chạy nằm tại `apps/api/src/db/schema.ts`; `database/schema/README.md` tham chiếu tới nguồn này. Giữ vị trí đó để build backend độc lập và không nhân bản schema.

## 6. Dành cho nhà phát triển

```bash
npm install
npm run test:crypto
npm run dev:api
npm run dev:web
```

Khi chạy local *không qua Docker*, bạn cần khởi động PostgreSQL, RustFS và Redis; API lấy cấu hình từ biến môi trường. Cách đơn giản nhất: chỉ chạy bằng Docker Compose như mục 2.

Swagger (khi API chạy): `http://localhost:8080/api/docs`.

## 7. Ghi chú kiến trúc, an toàn

- Trình duyệt tạo khóa bí mật. Backend chỉ nhận **publicKey**, **encrypted vault**, **ciphertext** và **envelopes**; không có API gửi tệp gốc.
- Vì JavaScript được server phân phối, chủ hạ tầng vẫn có thể thay đổi mã web. Cần kiểm soát CI/CD, release hashing, CSP/SRI và quy trình phát hành khi đi vào triển khai thật.
- Chữ ký ML-DSA xác nhận manifest/chữ ký hợp lệ, nhưng hệ thống tin cậy danh tính của public key cần được thiết kế đầy đủ. MVP cho người dùng xem fingerprint để xác minh ngoài kênh.
- Thu hồi chia sẻ ngăn yêu cầu tải mới qua API, nhưng không thu hồi bản plaintext đã giải mã hoặc ciphertext/khóa từng tải.
- **Chỉ HTTP localhost cho demo.** Khi công khai lên Internet: thêm HTTPS/TLS, domain, proxy config, `NODE_ENV=production`/Secure cookies, secrets managed, MFA, audit, backup, rà soát luồng ký/envelope và penetration test.
- Không coi ciphertext đơn khối hoặc 1 bài test tự động là chứng nhận mật mã.

## 8. Căn cứ và tham chiếu

- `docs/SPECIFICATION.md`: Đặc tả PQFile Secure Phần I–VIII do người dùng cung cấp.
- `docs/ui-reference.png`: Ảnh giao diện do người dùng cung cấp.
- Tailwind Nuxt v4: https://tailwindcss.com/docs/installation/framework-guides/nuxt
- Noble PQC: https://github.com/paulmillr/noble-post-quantum
- RustFS S3-compatible: https://docs.rustfs.com/en/installation/container

## Nâng cấp quản trị quyền và phân tích cục bộ (21/11/2026)

Bản mã nguồn mới có thêm **`/governance`** (đề xuất thu hồi, hạn công việc, bản đồ quyền) và **`/smart`** (chỉ mục AES-GCM tại trình duyệt, tìm nội dung, tóm tắt); trang tải lên kiểm tra chữ ký tệp trước khi mã hóa. Xem hướng dẫn và giới hạn trong [`docs/ADVANCED_SECURITY_AND_LOCAL_AI_2026.md`](docs/ADVANCED_SECURITY_AND_LOCAL_AI_2026.md). Chức năng NLP hiện dùng TF-IDF/ngữ nghĩa từ khóa, chưa thay thế AI embedding hoặc mô hình sinh tiếng Việt; AI cục bộ chỉ tùy chọn khi trình duyệt hỗ trợ.

## Tài khoản demo đầy đủ (bộ dữ liệu tổng hợp)

Có thể tạo riêng `demo.showcase@pqfile.local` cùng 120 tệp mã hóa, 66 lượt chia sẻ, 6 nhóm, nhật ký và cảnh báo bằng:

```bash
bash scripts/seed-showcase-macos.sh
```

Chỉ thực hiện trên môi trường nghiên cứu tách biệt đã nạp bộ V1, sau khi sao lưu dữ liệu. Các mật khẩu mới được lưu trong macOS Keychain. Đọc `docs/SHOWCASE_DEMO_ACCOUNT_2026.md` trước khi triển khai.
