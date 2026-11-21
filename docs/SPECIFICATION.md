# ĐẶC TẢ TỔNG THỂ HỆ THỐNG PQFILE SECURE

**Tên đề tài:** Nghiên cứu, xây dựng và đánh giá hệ thống bảo vệ tệp tin sử dụng thuật toán mật mã hậu lượng tử ML-KEM.

**Tên sản phẩm:** PQFile Secure

**Tên tiếng Anh:** Post-Quantum File Protection and Secure Sharing System

**Mô hình:** Full-stack Web Application

**Frontend:** TypeScript, Vue 3, Nuxt 4.

**Backend:** TypeScript, NestJS.

**Cơ sở dữ liệu:** PostgreSQL.

**Lưu trữ tệp:** S3-compatible Object Storage.

**Bảo mật:** ML-KEM, ML-DSA, AES-256-GCM, HKDF-SHA-256, Argon2id.

**Quản lý quyền:** Role-Based Access Control (RBAC) kết hợp Resource-Based Access Control.

**Mục tiêu sản phẩm:** Xây dựng hệ thống bảo vệ, lưu trữ, quản lý và chia sẻ tệp tin sử dụng mật mã hậu lượng tử, có đầy đủ chức năng người dùng, quản trị, Backend, cơ sở dữ liệu, kiểm soát truy cập và cơ chế bảo vệ dữ liệu.

---

# PHẦN I. TỔNG QUAN VÀ ĐỊNH HƯỚNG SẢN PHẨM

## 01. Mô tả tổng quan

PQFile Secure là hệ thống bảo vệ và chia sẻ tệp tin dựa trên mật mã hậu lượng tử, sử dụng ML-KEM để thiết lập và bảo vệ khóa mã hóa, kết hợp AES-256-GCM để mã hóa nội dung tệp tin.

Hệ thống được xây dựng dưới dạng ứng dụng web hoàn chỉnh với Frontend, Backend, PostgreSQL và dịch vụ lưu trữ tệp mã hóa.

Người dùng có thể đăng ký tài khoản, tạo và quản lý khóa mật mã, mã hóa tệp trước khi tải lên, lưu trữ tài liệu, chia sẻ dữ liệu với những người dùng khác, kiểm soát quyền truy cập và giải mã dữ liệu được cấp quyền.

Các chức năng quản lý tài khoản, phân quyền, lưu trữ, chia sẻ, thông báo và ghi nhận lịch sử được xử lý bởi Backend NestJS kết hợp PostgreSQL.

Việc mã hóa và giải mã nội dung được thực hiện tại thiết bị của người dùng. Máy chủ chỉ quản lý dữ liệu nghiệp vụ và nội dung đã mã hóa, không mặc nhiên có khả năng truy cập nội dung gốc.

Hệ thống còn sử dụng ML-DSA để xác thực nguồn gốc dữ liệu và phát hiện các thay đổi trái phép đối với thông tin được ký.

## 02. Các vấn đề cần giải quyết

Hệ thống hướng tới giải quyết:

1. Bảo vệ nội dung tệp tin khỏi truy cập trái phép.
2. Giảm nguy cơ lộ nội dung khi máy chủ lưu trữ bị xâm nhập.
3. Phát hiện tệp tin bị chỉnh sửa hoặc thay thế.
4. Hỗ trợ chia sẻ dữ liệu an toàn giữa nhiều tài khoản.
5. Quản lý khóa công khai và khóa bí mật.
6. Xác thực danh tính và nguồn gốc của tệp được chia sẻ.
7. Kiểm soát quyền truy cập ở cấp hệ thống, nhóm và tài nguyên.
8. Hỗ trợ sao lưu, khôi phục và thay đổi khóa.
9. Quản lý dữ liệu tập trung qua PostgreSQL.
10. Cung cấp giải pháp có thể triển khai và vận hành trên Internet.

## 03. Mục tiêu hệ thống

### 3.1. Mục tiêu tổng quát

Xây dựng một hệ thống bảo vệ và chia sẻ tệp tin có khả năng vận hành thực tế, sử dụng ML-KEM và các cơ chế mật mã hiện đại, đồng thời tích hợp đầy đủ chức năng quản lý tài khoản, phân quyền, lưu trữ, quản trị và bảo vệ dữ liệu.

### 3.2. Mục tiêu cụ thể

**Về mật mã và bảo mật**

- Tích hợp ML-KEM-512, ML-KEM-768 và ML-KEM-1024.
- Sử dụng AES-256-GCM để mã hóa nội dung.
- Dẫn xuất khóa bằng HKDF-SHA-256.
- Bảo vệ kho khóa bằng Argon2id kết hợp mã hóa xác thực.
- Tích hợp chữ ký số ML-DSA.
- Xây dựng cơ chế xác minh khóa công khai.
- Bảo vệ khóa bí mật khỏi việc truy cập từ Backend.
- Phát hiện tệp bị thay đổi trái phép.

**Về chức năng**

- Hệ thống tài khoản và xác thực.
- Quản lý người dùng và vai trò.
- Quản lý khóa mật mã.
- Mã hóa và giải mã tệp.
- Lưu trữ, quản lý và tổ chức tệp.
- Chia sẻ cho nhiều người nhận.
- Quản lý nhóm và không gian làm việc.
- Phân quyền truy cập.
- Chữ ký số và xác minh.
- Thông báo và nhật ký.
- Trang quản trị.
- Sao lưu và phục hồi dữ liệu hệ thống.

**Về kỹ thuật**

- Xây dựng Frontend bằng Nuxt 4 và Vue 3.
- Xây dựng Backend bằng NestJS.
- Thiết kế PostgreSQL.
- Tích hợp Object Storage.
- Sử dụng REST API và OpenAPI.
- Tích hợp Redis và hàng đợi công việc.
- Triển khai bằng Docker Compose.
- Xây dựng kiểm thử tự động và giám sát hệ thống.

## 04. Hệ thống vai trò người dùng (User Roles)

Hệ thống sử dụng RBAC kết hợp kiểm soát truy cập theo tài nguyên.

Vai trò được chia thành ba cấp độc lập:

1. Vai trò toàn hệ thống (System Roles).
2. Vai trò trong nhóm làm việc (Workspace Roles).
3. Quyền đối với tệp và thư mục (Resource Permissions).

Một người có thể đồng thời là người dùng thông thường của hệ thống, chủ sở hữu một nhóm và người được cấp quyền xem tệp thuộc nhóm khác.

### 4.1. Vai trò toàn hệ thống

| Mã vai trò | Tên vai trò | Mô tả |
|---|---|---|
| `GUEST` | Khách | Chưa đăng nhập |
| `USER` | Người dùng | Sử dụng đầy đủ các chức năng cá nhân được cấp |
| `SUPPORT` | Nhân viên hỗ trợ | Hỗ trợ tài khoản và xử lý yêu cầu |
| `SECURITY_AUDITOR` | Kiểm toán bảo mật | Xem nhật ký và sự kiện bảo mật theo phạm vi |
| `SYSTEM_ADMIN` | Quản trị viên | Quản trị hệ thống và người dùng |

`GUEST` là trạng thái chưa xác thực, không nhất thiết cần lưu thành bản ghi vai trò trong PostgreSQL.

#### A. Khách (GUEST)

Được phép:

- Truy cập trang giới thiệu.
- Xem tính năng sản phẩm.
- Xem hướng dẫn công khai.
- Đăng ký tài khoản.
- Đăng nhập.
- Yêu cầu khôi phục mật khẩu.
- Xem chính sách bảo mật và điều khoản sử dụng.

Không được phép:

- Truy cập Dashboard cá nhân.
- Xem danh sách người dùng nội bộ.
- Truy cập tệp tin riêng tư.
- Quản lý khóa người dùng.
- Sử dụng API yêu cầu đăng nhập.
- Truy cập khu vực quản trị.

#### B. Người dùng (USER)

Đây là vai trò mặc định được cấp cho tài khoản sau khi hoàn tất đăng ký và xác minh.

**Quản lý tài khoản**

- Xem và cập nhật hồ sơ.
- Thay đổi mật khẩu.
- Bật hoặc tắt MFA theo chính sách.
- Quản lý phiên đăng nhập.
- Thu hồi thiết bị.
- Xem hoạt động tài khoản.
- Yêu cầu xóa tài khoản.

**Quản lý khóa**

- Tạo khóa ML-KEM.
- Tạo khóa ML-DSA.
- Quản lý khóa công khai.
- Mở và khóa kho khóa bí mật.
- Sao lưu khóa.
- Khôi phục khóa.
- Xác minh khóa của người nhận.
- Thay đổi hoặc ngừng sử dụng khóa.

**Quản lý tệp**

- Mã hóa.
- Giải mã.
- Tải ciphertext lên máy chủ.
- Tải ciphertext về thiết bị.
- Tạo thư mục.
- Đổi tên thư mục.
- Di chuyển tệp được phép.
- Xóa tệp thuộc quyền sở hữu.
- Khôi phục tệp từ thùng rác.
- Xem lịch sử tệp.

**Chia sẻ**

- Chia sẻ tệp do mình sở hữu.
- Thêm người nhận.
- Cấp quyền theo chính sách.
- Thu hồi quyền truy cập máy chủ.
- Kiểm tra danh sách người nhận.
- Nhận tệp được chia sẻ.
- Xem và giải mã tệp nếu sở hữu khóa phù hợp.

**Nhóm làm việc**

- Tạo nhóm.
- Tham gia nhóm.
- Mời người khác nếu có quyền.
- Quản lý tài liệu theo vai trò được cấp.

Người dùng không được phép:

- Xem khóa bí mật của người khác.
- Xem tệp riêng tư không được cấp quyền.
- Thay đổi vai trò hệ thống.
- Truy cập API quản trị.
- Xem thông tin bảo mật riêng tư của tài khoản khác.
- Thay đổi cấu hình máy chủ.

#### C. Nhân viên hỗ trợ (SUPPORT)

Được phép:

- Xem thông tin tài khoản cần thiết cho hỗ trợ.
- Kiểm tra trạng thái xác minh email.
- Xem trạng thái tài khoản.
- Hỗ trợ xử lý yêu cầu đăng nhập.
- Kiểm tra trạng thái phiên theo phạm vi cho phép.
- Hỗ trợ yêu cầu khôi phục tài khoản.
- Tiếp nhận và quản lý yêu cầu hỗ trợ.
- Xem thông tin lỗi đã loại bỏ dữ liệu nhạy cảm.

Không được phép:

- Xem mật khẩu.
- Xem khóa bí mật.
- Giải mã tệp của người dùng.
- Truy cập nội dung tệp riêng tư.
- Tự ý thay đổi quyền hệ thống.
- Truy cập đầy đủ nhật ký bảo mật nếu không được cấp quyền.
- Cấp quyền quản trị cho tài khoản khác.

#### D. Kiểm toán bảo mật (SECURITY_AUDITOR)

Được phép:

- Xem audit log đã được giới hạn và che thông tin nhạy cảm.
- Xem sự kiện đăng nhập bất thường.
- Xem hoạt động quản trị.
- Xem các thay đổi phân quyền.
- Xem sự kiện liên quan đến khóa công khai.
- Xem thống kê an ninh.
- Xuất báo cáo kiểm toán theo phạm vi được cấp.

Không được phép:

- Sửa hoặc xóa nhật ký.
- Quản lý tài khoản như quản trị viên.
- Xem plaintext tệp.
- Xem khóa bí mật.
- Tự ý thay đổi chính sách bảo mật.

#### E. Quản trị viên hệ thống (SYSTEM_ADMIN)

Được phép:

- Quản lý danh sách tài khoản.
- Khóa hoặc mở khóa tài khoản.
- Quản lý vai trò toàn hệ thống.
- Quản lý giới hạn dung lượng.
- Xem trạng thái PostgreSQL.
- Xem tình trạng Object Storage.
- Quản lý cấu hình nghiệp vụ.
- Quản lý chính sách bảo mật.
- Xem nhật ký hệ thống.
- Xử lý sự cố.
- Quản lý tài nguyên dịch vụ.
- Theo dõi công việc nền.
- Quản lý chính sách sao lưu và phục hồi.

Không được mặc nhiên phép:

- Đọc nội dung tệp đã giải mã.
- Truy cập khóa bí mật dạng rõ.
- Sử dụng khóa người dùng để giải mã.
- Vượt qua cơ chế xác minh chữ ký.
- Tự động trở thành chủ sở hữu tài liệu của mọi tài khoản.

Cần phân biệt quyền quản trị ứng dụng với quyền truy cập hạ tầng. Người có quyền điều khiển máy chủ triển khai ứng dụng vẫn là một chủ thể có khả năng gây rủi ro đối với mã Frontend được phân phối tới người dùng; đây là giới hạn cần kiểm soát bằng quy trình phát hành và quản trị hạ tầng.

### 4.2. Vai trò trong nhóm làm việc (Workspace Roles)

| Vai trò | Ý nghĩa |
|---|---|
| `OWNER` | Chủ sở hữu nhóm |
| `ADMIN` | Quản trị nhóm |
| `EDITOR` | Thành viên biên tập |
| `UPLOADER` | Thành viên được phép tải tệp lên |
| `VIEWER` | Thành viên chỉ xem hoặc tải tài liệu được phép |

#### Workspace Owner

- Quản lý toàn bộ thành viên.
- Cấp hoặc thu hồi vai trò trong nhóm.
- Quản lý cấu hình nhóm.
- Tạo và quản lý thư mục.
- Cấp quyền chia sẻ theo chính sách.
- Chuyển quyền sở hữu.
- Xóa nhóm theo quy trình xác nhận.

#### Workspace Admin

- Mời thành viên.
- Quản lý thành viên trong phạm vi được cấp.
- Quản lý thư mục nhóm.
- Cấp quyền cho tài liệu được phép.
- Theo dõi hoạt động nhóm.

Không được tự ý chuyển quyền sở hữu hoặc xóa nhóm nếu chính sách không cho phép.

#### Workspace Editor

- Xem tài liệu được cấp quyền.
- Tải ciphertext.
- Giải mã nếu có khóa phù hợp.
- Tải lên bản sửa đổi.
- Cập nhật tài liệu theo chính sách.
- Quản lý tài liệu do mình tạo trong phạm vi được phép.

#### Workspace Uploader

- Tải tệp đã mã hóa vào thư mục được chỉ định.
- Xem các tệp do mình tạo.
- Theo dõi trạng thái upload.

Không được mặc nhiên đọc hoặc giải mã mọi tài liệu đã có trong nhóm.

#### Workspace Viewer

- Xem danh sách tài liệu được cấp quyền.
- Xem metadata được phép.
- Tải ciphertext.
- Giải mã nếu có khóa phù hợp.
- Xác minh chữ ký.

Không được sửa, xóa hoặc cấp lại quyền nếu không có quyền bổ sung.

### 4.3. Quyền đối với tệp và thư mục

Các quyền ở cấp tài nguyên:

| Mã quyền | Ý nghĩa |
|---|---|
| `FILE_READ_METADATA` | Xem metadata được phép |
| `FILE_DOWNLOAD` | Tải ciphertext |
| `FILE_CREATE_REVISION` | Tạo bản sửa đổi |
| `FILE_MANAGE` | Quản lý tài liệu |
| `FILE_SHARE` | Chia sẻ tệp |
| `FILE_DELETE` | Xóa tệp |
| `FILE_RESTORE` | Khôi phục tệp |
| `FOLDER_CREATE` | Tạo thư mục |
| `FOLDER_UPLOAD` | Tải tệp lên thư mục |
| `FOLDER_MANAGE` | Quản lý thư mục |
| `WORKSPACE_MANAGE` | Quản lý nhóm |
| `MEMBER_MANAGE` | Quản lý thành viên |

**Quyền tải tệp không đồng nghĩa với khả năng giải mã tệp.** Để giải mã thành công, người dùng còn phải có recipient envelope hợp lệ và khóa bí mật tương ứng.

### 4.4. Ma trận phân quyền toàn hệ thống

| Chức năng | GUEST | USER | SUPPORT | AUDITOR | ADMIN |
|---|---|---|---|---|---|
| Xem trang công khai | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đăng ký | ✓ | — | — | — | — |
| Đăng nhập | ✓ | ✓ | ✓ | ✓ | ✓ |
| Quản lý tài khoản cá nhân | — | ✓ | ✓ | ✓ | ✓ |
| Quản lý khóa cá nhân | — | ✓ | ✓ | ✓ | ✓ |
| Mã hóa, giải mã dữ liệu của mình | — | ✓ | ✓ | ✓ | ✓ |
| Truy cập tài liệu người khác | — | Theo quyền | Theo quyền | Theo quyền | Theo quyền |
| Quản lý nhóm của mình | — | Theo vai trò nhóm | Theo vai trò nhóm | Theo vai trò nhóm | Theo vai trò nhóm |
| Hỗ trợ tài khoản khác | — | — | ✓ | — | ✓ |
| Xem audit log toàn hệ thống | — | — | — | ✓ | ✓ |
| Sửa vai trò hệ thống | — | — | — | — | ✓ |
| Quản lý cấu hình hệ thống | — | — | — | — | ✓ |
| Xem khóa bí mật người khác | — | — | — | — | — |
| Giải mã tệp không được cấp quyền | — | — | — | — | — |

Trong bảng, dấu ✓ ở các thao tác cá nhân có nghĩa là thực hiện trên dữ liệu của chính tài khoản đó, không mở rộng sang dữ liệu của tài khoản khác.

### 4.5. Cơ chế cấp quyền

Mọi yêu cầu truy cập tài nguyên phải được kiểm tra ở Backend theo các điều kiện:

1. Người dùng đã đăng nhập hợp lệ.
2. Tài khoản ở trạng thái được phép hoạt động.
3. Phiên đăng nhập chưa hết hạn hoặc bị thu hồi.
4. Có quyền đối với hành động yêu cầu.
5. Có quyền đối với tài nguyên cụ thể.
6. Tài nguyên chưa bị xóa hoặc khóa.
7. Quyền chia sẻ chưa hết hạn hoặc bị thu hồi.
8. Các chính sách của nhóm được đáp ứng.

Frontend chỉ hiển thị các thao tác phù hợp, nhưng Backend mới là nơi quyết định cho phép hoặc từ chối.

Các tài khoản dịch vụ như API Worker phải có danh tính và quyền kỹ thuật riêng, không dùng chung quyền `SYSTEM_ADMIN`.

## 05. Nguyên tắc thiết kế

- Security by Design.
- Client-side Encryption.
- Least Privilege.
- Default Deny.
- RBAC kết hợp kiểm tra theo tài nguyên.
- Separation of Concerns.
- Defense in Depth.
- Data Minimization.
- Fail-Closed.
- Auditability.
- Maintainability.
- Interoperability.

---

# PHẦN II. ĐẶC TẢ CHỨC NĂNG HỆ THỐNG

## 06. Hệ thống tài khoản

**FR-01. Đăng ký:** tạo tài khoản bằng email, mật khẩu và xác minh địa chỉ email.

**FR-02. Đăng nhập:** xác thực thông tin, MFA, quản lý phiên, giới hạn số lần thử và đăng xuất.

**FR-03. Khôi phục tài khoản:** đặt lại mật khẩu đăng nhập qua quy trình xác minh. Không tự động khôi phục khóa giải mã đã mất.

**FR-04. Quản lý hồ sơ:** thay đổi thông tin cá nhân, email, mật khẩu, MFA, phiên đăng nhập và yêu cầu xóa tài khoản.

## 07. Quản lý người dùng và vai trò

**FR-05. Quản lý vai trò hệ thống**

- Tạo và cấu hình những vai trò được cho phép tùy chỉnh.
- Xem vai trò hiện tại.
- Gán vai trò cho tài khoản theo thẩm quyền.
- Thu hồi vai trò.
- Kiểm tra quyền.
- Lưu lịch sử thay đổi vai trò.

Các vai trò nền tảng phải được bảo vệ để tránh tạo đường leo thang đặc quyền.

**FR-06. Quản lý vai trò nhóm**

- Tạo nhóm.
- Gán Owner.
- Thêm Admin, Editor, Uploader và Viewer.
- Thay đổi vai trò thành viên.
- Thu hồi quyền nhóm.
- Kiểm soát quyền sở hữu và quyền truy cập tệp.

**FR-07. Kiểm soát quyền truy cập**

- Kiểm tra vai trò toàn hệ thống.
- Kiểm tra thành viên nhóm.
- Kiểm tra quyền tài nguyên.
- Kiểm tra thời hạn chia sẻ.
- Kiểm tra trạng thái khóa hoặc tài khoản.
- Từ chối mặc định nếu không thỏa điều kiện.

## 08. Quản lý khóa mật mã

**FR-08. Tạo cặp khóa ML-KEM:** hỗ trợ ba bộ tham số, có fingerprint, định danh và chính sách lựa chọn cấu hình.

**FR-09. Tạo cặp khóa ML-DSA:** tạo khóa ký, quản lý khóa công khai và bảo vệ khóa ký bí mật.

**FR-10. Quản lý khóa bí mật:** khóa/mở kho khóa, bảo vệ bằng mật khẩu, lưu bản mã hóa, ngừng sử dụng và quản lý vòng đời.

**FR-11. Xuất/nhập khóa:** kiểm tra định dạng, kích thước, tham số và fingerprint.

**FR-12. Danh bạ khóa:** tìm người nhận, xem khóa công khai, xác minh khóa và phát hiện thay đổi.

**FR-13. Sao lưu/khôi phục:** xuất bản sao khóa đã mã hóa, khôi phục trên thiết bị khác và kiểm tra khả năng giải mã sau khôi phục.

## 09. Mã hóa tệp tin

**FR-14. Chọn tệp:** chọn nhiều tệp, kéo thả, kiểm tra dung lượng và loại tệp.

**FR-15. Mã hóa:** chọn người nhận, tạo khóa nội dung, dùng ML-KEM bảo vệ khóa, mã hóa tệp bằng AES-GCM và xác thực dữ liệu.

**FR-16. Upload:** tạo phiên tải lên, lưu ciphertext và metadata, theo dõi tiến độ, kiểm tra tính toàn vẹn.

**FR-17. Xử lý hàng loạt:** hàng đợi, tiến độ, hủy tác vụ, lỗi độc lập và giới hạn tài nguyên.

## 10. Giải mã tệp tin

**FR-18. Giải mã tệp cá nhân:** đọc định dạng, chọn khóa, mở kho khóa, khôi phục khóa nội dung, giải mã và xác thực đầy đủ.

**FR-19. Giải mã tệp được chia sẻ:** kiểm tra quyền, tải ciphertext, xác minh chữ ký và giải mã bằng khóa riêng.

**FR-20. Xử lý lỗi:** từ chối tệp sai khóa, sai định dạng, bị sửa đổi, thiếu dữ liệu hoặc không đáp ứng điều kiện an toàn.

Không xuất plaintext khi chưa hoàn thành xác thực toàn bộ tệp.

## 11. Quản lý tệp và thư mục

**FR-21. Quản lý tệp:** danh sách, tìm kiếm theo metadata được phép, sắp xếp, đánh dấu, di chuyển, xóa và khôi phục.

**FR-22. Quản lý thư mục:** tạo, đổi tên, di chuyển, phân quyền và quản lý cấu trúc.

**FR-23. Quản lý bản sửa đổi:** lưu nhiều bản ciphertext của cùng tài liệu, xem lịch sử và khôi phục bản được phép.

## 12. Chia sẻ và phân quyền

**FR-24. Chia sẻ tệp:** chọn người nhận, xác minh khóa, tạo recipient envelope và cấp quyền.

**FR-25. Chia sẻ nhiều người nhận:** mã hóa nội dung một lần, bảo vệ khóa nội dung riêng cho từng người nhận.

**FR-26. Quản lý quyền:** xem, tạo bản sửa đổi, chia sẻ, xóa, giới hạn thời hạn và thu hồi quyền theo chính sách.

**FR-27. Liên kết chia sẻ:** liên kết có thời hạn, giới hạn đối tượng, kiểm tra quyền và thu hồi.

Thu hồi quyền máy chủ không thể xóa những bản dữ liệu người nhận đã tải và giải mã trước đó.

## 13. Chữ ký số

**FR-28. Ký số:** sử dụng ML-DSA để ký manifest, xác thực người gửi và tính toàn vẹn thông tin liên quan.

**FR-29. Xác minh chữ ký:** kiểm tra chữ ký, khóa ký, fingerprint, trạng thái tin cậy và các thông tin được ký.

## 14. Không gian làm việc

**FR-30. Quản lý nhóm:** tạo nhóm, mời thành viên, phân quyền và quản lý thành viên.

**FR-31. Quản lý tài liệu nhóm:** thư mục, tài liệu, quyền truy cập, bản sửa đổi và hoạt động nhóm.

## 15. Thông báo và nhật ký

**FR-32. Thông báo:** tệp mới, lời mời, thay đổi quyền, thay đổi khóa, cảnh báo tài khoản và tình trạng lưu trữ.

**FR-33. Lịch sử hoạt động:** đăng nhập, thay đổi khóa, upload, download, chia sẻ và các thao tác quan trọng.

## 16. Quản trị

**FR-34. Dashboard:** thống kê người dùng, tệp, dung lượng, tình trạng Backend, PostgreSQL, Object Storage và sự kiện hệ thống.

**FR-35. Quản lý người dùng:** tìm kiếm, khóa/mở khóa, quản lý trạng thái, vai trò và hạn mức.

**FR-36. Quản lý hệ thống:** cấu hình, chính sách, giám sát, backup, hàng đợi và sự cố.

**FR-37. Kiểm toán:** xem audit log, phát hiện hành vi bất thường và xuất báo cáo theo quyền.

---

# PHẦN III. THIẾT KẾ GIAO DIỆN

## 17. Danh sách màn hình

| Màn hình | Đường dẫn | Vai trò |
|---|---|---|
| Trang giới thiệu | `/` | Tất cả |
| Đăng ký | `/register` | GUEST |
| Đăng nhập | `/login` | GUEST |
| Xác minh email | `/verify-email` | Người cần xác minh |
| Khôi phục mật khẩu | `/forgot-password` | GUEST |
| Dashboard | `/dashboard` | USER trở lên |
| Tệp của tôi | `/files` | Người dùng đã xác thực |
| Mã hóa | `/encrypt` | Người dùng đã xác thực |
| Giải mã | `/decrypt` | Người dùng đã xác thực |
| Được chia sẻ với tôi | `/shared-with-me` | Người dùng đã xác thực |
| Tôi đã chia sẻ | `/shared-by-me` | Người dùng đã xác thực |
| Nhóm làm việc | `/workspaces` | Theo quyền nhóm |
| Quản lý khóa | `/keys` | Người dùng đã xác thực |
| Sao lưu khóa | `/keys/backup` | Người dùng đã xác thực |
| Xác minh khóa | `/keys/verify` | Người dùng đã xác thực |
| Lịch sử cá nhân | `/activity` | Người dùng đã xác thực |
| Thông báo | `/notifications` | Người dùng đã xác thực |
| Hồ sơ | `/profile` | Người dùng đã xác thực |
| Bảo mật tài khoản | `/settings/security` | Người dùng đã xác thực |
| Quản trị hệ thống | `/admin` | SYSTEM_ADMIN |
| Quản lý người dùng | `/admin/users` | SYSTEM_ADMIN |
| Quản lý vai trò | `/admin/roles` | SYSTEM_ADMIN |
| Quản lý lưu trữ | `/admin/storage` | SYSTEM_ADMIN |
| Quản lý nhóm | `/admin/workspaces` | SYSTEM_ADMIN, có giới hạn |
| Nhật ký kiểm toán | `/admin/audit-logs` | SYSTEM_ADMIN, SECURITY_AUDITOR |
| Giám sát | `/admin/monitoring` | SYSTEM_ADMIN |
| Hỗ trợ | `/support` | SUPPORT |
| Bảo mật và kiểm toán | `/security-audit` | SECURITY_AUDITOR |

## 18. Giao diện người dùng

### 18.1. Dashboard

Hiển thị:

- Tổng tệp của tôi.
- Dung lượng đang sử dụng.
- Tệp đã chia sẻ.
- Tệp được nhận.
- Nhóm đang tham gia.
- Trạng thái kho khóa.
- Hoạt động gần đây.
- Các thao tác nhanh.

### 18.2. Quản lý tệp

- Danh sách hoặc dạng lưới.
- Breadcrumb.
- Tìm kiếm.
- Tạo thư mục.
- Upload.
- Mã hóa.
- Giải mã.
- Chia sẻ.
- Xóa.
- Khôi phục.
- Thông tin bản sửa đổi.

Các hành động bị từ chối bởi quyền phải được ẩn hoặc vô hiệu hóa thích hợp trên giao diện, đồng thời luôn được kiểm tra lại ở Backend.

### 18.3. Mã hóa

Quy trình:

**Chọn tệp → Chọn người nhận → Xác minh khóa → Mã hóa → Lưu hoặc upload**

### 18.4. Giải mã

Quy trình:

**Chọn tệp → Kiểm tra quyền → Mở khóa → Xác minh → Giải mã → Lưu tệp**

### 18.5. Quản lý nhóm

- Danh sách nhóm.
- Danh sách thành viên.
- Vai trò thành viên.
- Mời hoặc xóa thành viên.
- Thư mục nhóm.
- Quyền truy cập tài liệu.
- Nhật ký hoạt động nhóm theo quyền.

## 19. Giao diện quản trị

### 19.1. System Admin Dashboard

- Số người dùng.
- Trạng thái tài khoản.
- Số nhóm.
- Dung lượng.
- Tình trạng dịch vụ.
- Lỗi API.
- Các cảnh báo an ninh.

### 19.2. User Management

- Tìm kiếm tài khoản.
- Xem trạng thái.
- Khóa/mở khóa.
- Gán vai trò.
- Thu hồi vai trò.
- Kiểm tra phiên đăng nhập.
- Xem sự kiện quản trị liên quan.

### 19.3. Role Management

- Danh sách vai trò.
- Danh sách quyền.
- Gán quyền.
- Xem tài khoản theo vai trò.
- Lịch sử thay đổi.
- Cảnh báo đối với quyền nguy hiểm.

Các quyền nền tảng phải có ràng buộc, không để quản trị viên vô tình tạo vai trò có thể vượt qua giới hạn bảo vệ dữ liệu.

## 20. Yêu cầu UX/UI

- Responsive.
- Dark mode.
- Tiếng Việt.
- Hỗ trợ đa ngôn ngữ.
- Keyboard navigation.
- Accessibility.
- Trạng thái loading và processing.
- Tiến độ tải tệp.
- Thông báo lỗi rõ ràng.
- Xác nhận thao tác quan trọng.
- Không hiển thị nội dung bí mật khi chưa cần.
- Không tự động chuyển plaintext lên máy chủ.
- Thiết kế nhất quán giữa Frontend và khu vực quản trị.

---

# PHẦN IV. KIẾN TRÚC HỆ THỐNG VÀ CÔNG NGHỆ

## 21. Kiến trúc tổng thể

Hệ thống bao gồm:

**Frontend → Backend API → PostgreSQL / Object Storage / Redis**

Lõi mật mã được thực thi trong môi trường phía người dùng:

**Frontend → Web Worker → Crypto Core → Tệp mã hóa/giải mã**

### Frontend

- Nuxt 4.
- Vue 3.
- TypeScript.
- Tailwind CSS.
- Nuxt UI.
- Web Crypto API.
- Thư viện ML-KEM và ML-DSA.
- Web Workers.

### Backend

- NestJS.
- TypeScript.
- REST API.
- Authentication.
- Authorization.
- RBAC.
- Business Services.
- Object Storage integration.
- Audit logging.
- Administration.

### Database

- PostgreSQL.
- Drizzle ORM.
- Migrations.
- Transactions.
- Indexes.
- Ràng buộc toàn vẹn.
- RLS ở những bảng phù hợp.

### Object Storage

- Lưu ciphertext.
- Quản lý phiên upload.
- Quản lý download.
- Kiểm tra checksum.
- Giới hạn dung lượng.
- Quản lý vòng đời đối tượng.

### Redis

- Hàng đợi thông báo.
- Công việc dọn dữ liệu tạm.
- Công việc email.
- Tác vụ quản trị.
- Điều phối công việc nền.

## 22. Bảng công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | Nuxt 4 |
| UI Framework | Vue 3 |
| Ngôn ngữ | TypeScript |
| Styling | Tailwind CSS |
| Backend | NestJS |
| API | REST/OpenAPI |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Cache/Queue | Redis, BullMQ |
| File Storage | S3-compatible |
| Authentication | Server-side sessions hoặc cơ chế token được kiểm soát |
| Authorization | RBAC + Resource-Based |
| ML-KEM | `@noble/post-quantum` hoặc thư viện đã được đánh giá phù hợp |
| ML-DSA | Thư viện mật mã được đánh giá phù hợp |
| AES-GCM | Web Crypto API |
| HKDF | Web Crypto API |
| Key Protection | Argon2id + AES-GCM |
| Testing | Vitest, Playwright, Supertest |
| Deployment | Docker Compose |
| Monitoring | Prometheus, Grafana |

## 23. Cấu trúc mã nguồn

`pqfile-secure/`

**apps/**

- `web/`: Nuxt Frontend.
- `api/`: NestJS Backend.
- `worker/`: Background worker.

**packages/**

- `crypto-core/`
- `file-format/`
- `key-vault/`
- `shared-types/`
- `shared-validation/`
- `ui/`
- `api-client/`
- `authorization/`

**database/**

- `schema/`
- `migrations/`
- `seeds/`
- `policies/`

**infrastructure/**

- `docker/`
- `compose/`
- `nginx/`
- `monitoring/`
- `backup/`

**tests/**

- `unit/`
- `integration/`
- `e2e/`
- `security/`
- `performance/`

**docs/**

- Yêu cầu phần mềm.
- Kiến trúc.
- API.
- Database.
- RBAC.
- Thiết kế mật mã.
- Threat model.
- Hướng dẫn vận hành.

## 24. Backend Modules

| Module | Trách nhiệm |
|---|---|
| AuthModule | Xác thực |
| UsersModule | Quản lý tài khoản |
| SessionsModule | Phiên |
| MfaModule | MFA |
| RolesModule | Vai trò |
| PermissionsModule | Quyền |
| AuthorizationModule | Kiểm tra quyền nghiệp vụ |
| KeysModule | Khóa công khai |
| VaultModule | Bản sao khóa đã mã hóa |
| FilesModule | Tệp |
| FoldersModule | Thư mục |
| UploadsModule | Upload |
| DownloadsModule | Download |
| SharesModule | Chia sẻ |
| WorkspacesModule | Nhóm |
| NotificationsModule | Thông báo |
| ActivityModule | Lịch sử |
| AuditModule | Kiểm toán |
| AdminModule | Quản trị |
| StorageModule | Lưu trữ |
| HealthModule | Tình trạng dịch vụ |

## 25. Thiết kế REST API

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/mfa/verify`
- `GET /api/auth/sessions`
- `DELETE /api/auth/sessions/{id}`

### Người dùng

- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/search`
- `GET /api/users/{id}/public-keys`
- `DELETE /api/users/me`

### Khóa

- `GET /api/keys`
- `POST /api/keys`
- `GET /api/keys/{id}`
- `PATCH /api/keys/{id}`
- `POST /api/keys/backups`
- `GET /api/keys/backups`

### Tệp

- `GET /api/files`
- `GET /api/files/{id}`
- `PATCH /api/files/{id}`
- `DELETE /api/files/{id}`
- `POST /api/files/{id}/restore`
- `GET /api/files/{id}/revisions`
- `POST /api/uploads`
- `POST /api/uploads/{id}/complete`
- `POST /api/uploads/{id}/abort`
- `POST /api/files/{id}/download`

### Chia sẻ

- `POST /api/files/{id}/shares`
- `GET /api/files/{id}/shares`
- `PATCH /api/shares/{id}`
- `DELETE /api/shares/{id}`
- `GET /api/shares/incoming`
- `GET /api/shares/outgoing`

### Nhóm

- `POST /api/workspaces`
- `GET /api/workspaces`
- `GET /api/workspaces/{id}`
- `POST /api/workspaces/{id}/members`
- `PATCH /api/workspaces/{id}/members/{userId}`
- `DELETE /api/workspaces/{id}/members/{userId}`

### Vai trò và quyền

- `GET /api/admin/roles`
- `POST /api/admin/roles`
- `PATCH /api/admin/roles/{id}`
- `GET /api/admin/permissions`
- `PUT /api/admin/roles/{id}/permissions`
- `PUT /api/admin/users/{id}/roles`
- `GET /api/admin/role-change-history`

### Quản trị

- `GET /api/admin/users`
- `GET /api/admin/storage`
- `GET /api/admin/audit-logs`
- `GET /api/admin/system/health`
- `GET /api/admin/system/metrics`
- `GET /api/admin/settings`

Mọi API cần có validation, authentication khi cần, authorization ở cấp tài nguyên, giới hạn request và mã lỗi chuẩn hóa.

---

# PHẦN V. THIẾT KẾ HỆ THỐNG MẬT MÃ

## 26. Thuật toán sử dụng

### ML-KEM

Theo FIPS 203:

| Thuộc tính | ML-KEM-512 | ML-KEM-768 | ML-KEM-1024 |
|---|---:|---:|---:|
| Security category | 1 | 3 | 5 |
| Public key | 800 B | 1.184 B | 1.568 B |
| Secret key | 1.632 B | 2.400 B | 3.168 B |
| KEM ciphertext | 768 B | 1.088 B | 1.568 B |
| Shared secret | 32 B | 32 B | 32 B |

ML-KEM-768 được lựa chọn làm cấu hình mặc định.

### AES-256-GCM

- Khóa 256 bit.
- Nonce 96 bit.
- Authentication tag 128 bit.
- Nonce không được trùng dưới cùng khóa.
- Sử dụng AAD để liên kết dữ liệu quan trọng.

### HKDF-SHA-256

Dẫn xuất khóa từ bí mật chung ML-KEM, sử dụng các ngữ cảnh riêng biệt.

### Argon2id

Bảo vệ bản sao khóa bí mật bằng mật khẩu người dùng. Tham số được chọn dựa trên yêu cầu an toàn và khả năng xử lý của thiết bị.

### ML-DSA

Theo FIPS 204, sử dụng cho chữ ký và xác minh nguồn gốc tệp tin.

## 27. Quy trình mã hóa

1. Người dùng chọn tệp.
2. Chọn người nhận.
3. Xác minh khóa công khai.
4. Sinh khóa nội dung ngẫu nhiên.
5. Dẫn xuất khóa AES-GCM.
6. Mã hóa dữ liệu theo khối.
7. Tạo recipient envelope bằng ML-KEM và cơ chế bọc khóa.
8. Tạo metadata mã hóa.
9. Tạo manifest.
10. Ký manifest bằng ML-DSA.
11. Đóng gói dữ liệu.
12. Tải ciphertext lên Object Storage.
13. Lưu metadata và quyền vào PostgreSQL.

## 28. Quy trình giải mã

1. Kiểm tra tài khoản và quyền.
2. Tải ciphertext.
3. Đọc định dạng.
4. Kiểm tra chữ ký và trạng thái tin cậy.
5. Xác định recipient envelope.
6. Mở khóa bí mật.
7. Thực hiện decapsulation.
8. Dẫn xuất khóa bảo vệ khóa nội dung.
9. Khôi phục khóa nội dung.
10. Giải mã dữ liệu.
11. Xác minh các record.
12. Kiểm tra record cuối cùng.
13. Công bố tệp khi toàn bộ quá trình thành công.

## 29. Mã hóa nhiều người nhận

Một tệp có khóa nội dung riêng.

Mỗi người nhận có recipient envelope riêng, được tạo từ khóa công khai đã xác minh.

Các envelope được lưu cùng thông tin quản lý của bản tài liệu.

Backend kiểm soát ai được tải envelope và ciphertext, còn khả năng giải mã phụ thuộc khóa mật mã phía người nhận.

## 30. Định dạng tệp

Định dạng đề xuất: `.pqf`

| Thành phần | Nội dung |
|---|---|
| Magic | Nhận diện định dạng |
| Header | Bộ thuật toán và tham số |
| Recipient Envelopes | Khóa nội dung đã bọc |
| Encrypted Metadata | Metadata nhạy cảm |
| Encrypted Records | Dữ liệu mã hóa |
| Final Record | Xác nhận hoàn tất |
| Signature Manifest | Xác thực nguồn gốc |

Định dạng phải được đặc tả chính xác về encoding, kích thước, AAD, nonce, thứ tự record, phiên bản định dạng, giới hạn và cách xử lý lỗi.

## 31. Quản lý khóa

- Sinh khóa trên thiết bị.
- Không truyền secret key dạng rõ.
- Lưu backup đã mã hóa.
- Không lưu mật khẩu kho khóa.
- Xác minh khóa công khai.
- Hỗ trợ xoay khóa.
- Hỗ trợ khóa cũ để giải mã tệp trước đó.
- Có trạng thái revoked và retired.
- Không cho phép bỏ qua lỗi xác thực.
- Không để Admin mặc nhiên có khả năng giải mã.

---

# PHẦN VI. THIẾT KẾ POSTGRESQL

## 32. Nguyên tắc cơ sở dữ liệu

- UUID làm khóa định danh.
- Khóa ngoại và ràng buộc toàn vẹn.
- Migration có kiểm soát.
- Chỉ mục cho truy vấn thường xuyên.
- Transaction cho thao tác liên quan nhiều bảng.
- Kiểm tra phân quyền ở Backend.
- Sử dụng RLS như lớp phòng vệ bổ sung khi phù hợp.
- Không lưu khóa bí mật dạng rõ.
- Không dùng PostgreSQL làm kho lưu trữ chính cho ciphertext dung lượng lớn.
- Sao lưu và khôi phục theo chính sách.
- Mọi truy vấn từ Frontend đi qua Backend.

## 33. Danh sách bảng

### A. Tài khoản

- `users`
- `user_profiles`
- `user_credentials`
- `user_sessions`
- `email_verifications`
- `password_reset_tokens`
- `mfa_credentials`

### B. Vai trò và quyền

- `roles`
- `permissions`
- `role_permissions`
- `user_roles`
- `role_change_logs`

### C. Khóa mật mã

- `user_keys`
- `key_backups`
- `trusted_keys`
- `key_rotations`
- `key_revocations`

### D. Tệp và thư mục

- `folders`
- `files`
- `file_revisions`
- `file_objects`
- `file_recipients`
- `upload_sessions`
- `download_events`
- `deleted_files`

### E. Chia sẻ

- `file_shares`
- `share_links`
- `workspaces`
- `workspace_members`
- `workspace_files`
- `workspace_invitations`

### F. Nhật ký và cấu hình

- `notifications`
- `activity_logs`
- `audit_logs`
- `security_events`
- `system_settings`
- `storage_quotas`

## 34. Bảng `users`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `email` | VARCHAR(255) UNIQUE |
| `display_name` | VARCHAR(150) |
| `status` | VARCHAR(30) |
| `email_verified_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

## 35. Bảng `roles`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `code` | VARCHAR(50) UNIQUE |
| `name` | VARCHAR(100) |
| `description` | TEXT |
| `is_system_role` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |

Vai trò nền tảng không được tự ý xóa nếu đang cần cho các ràng buộc hệ thống.

## 36. Bảng `permissions`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `code` | VARCHAR(100) UNIQUE |
| `resource` | VARCHAR(100) |
| `action` | VARCHAR(50) |
| `description` | TEXT |

Ví dụ:

- `users.read`
- `users.manage`
- `roles.assign`
- `files.read_metadata`
- `files.download`
- `files.share`
- `files.delete`
- `workspaces.manage`
- `audit.read`
- `system.settings.manage`

## 37. Bảng `role_permissions`

| Trường | Kiểu |
|---|---|
| `role_id` | UUID FK |
| `permission_id` | UUID FK |

Khóa chính tổng hợp: `role_id`, `permission_id`.

## 38. Bảng `user_roles`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `role_id` | UUID FK |
| `assigned_by` | UUID FK |
| `assigned_at` | TIMESTAMPTZ |

Cần kiểm tra quyền người thực hiện trước khi gán hoặc thu hồi vai trò.

## 39. Bảng `workspace_members`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `workspace_id` | UUID FK |
| `user_id` | UUID FK |
| `role` | VARCHAR(30) |
| `status` | VARCHAR(30) |
| `joined_at` | TIMESTAMPTZ |

Ràng buộc duy nhất theo cặp `workspace_id`, `user_id`.

Vai trò nhóm không được nhầm với vai trò toàn hệ thống.

## 40. Bảng `user_keys`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `purpose` | VARCHAR(20) |
| `algorithm` | VARCHAR(30) |
| `parameter_set` | VARCHAR(30) |
| `public_key` | BYTEA |
| `fingerprint` | VARCHAR(128) |
| `status` | VARCHAR(30) |
| `created_at` | TIMESTAMPTZ |
| `revoked_at` | TIMESTAMPTZ |

## 41. Bảng `key_backups`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `key_id` | UUID FK |
| `encrypted_blob` | BYTEA |
| `kdf_parameters` | JSONB |
| `format_version` | INTEGER |
| `created_at` | TIMESTAMPTZ |

## 42. Bảng `files`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `owner_id` | UUID FK |
| `folder_id` | UUID FK |
| `current_revision_id` | UUID |
| `display_label` | TEXT |
| `status` | VARCHAR(30) |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `deleted_at` | TIMESTAMPTZ |

## 43. Bảng `file_recipients`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `revision_id` | UUID FK |
| `recipient_id` | UUID FK |
| `recipient_key_id` | UUID FK |
| `kem_ciphertext` | BYTEA |
| `wrapped_master_key` | BYTEA |
| `wrap_parameters` | JSONB |
| `grant_signature` | BYTEA |
| `status` | VARCHAR(30) |
| `created_at` | TIMESTAMPTZ |

## 44. Bảng `file_shares`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `file_id` | UUID FK |
| `shared_by` | UUID FK |
| `shared_with` | UUID FK |
| `permission` | VARCHAR(30) |
| `expires_at` | TIMESTAMPTZ |
| `revoked_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |

## 45. Bảng `audit_logs`

| Trường | Kiểu |
|---|---|
| `id` | UUID PK |
| `actor_id` | UUID |
| `action` | VARCHAR(100) |
| `resource_type` | VARCHAR(50) |
| `resource_id` | UUID |
| `result` | VARCHAR(20) |
| `ip_address` | INET |
| `created_at` | TIMESTAMPTZ |
| `details` | JSONB |

Không ghi mật khẩu, khóa bí mật, session token hoặc nội dung plaintext vào audit log.

## 46. Quan hệ dữ liệu và phân quyền

- Một người dùng có nhiều phiên.
- Một người dùng có nhiều vai trò nếu chính sách cho phép.
- Một vai trò có nhiều quyền.
- Một quyền có thể thuộc nhiều vai trò.
- Một người dùng có nhiều khóa.
- Một người dùng sở hữu nhiều tệp.
- Một tệp có nhiều bản sửa đổi.
- Một bản sửa đổi có nhiều recipient envelope.
- Một tệp có nhiều quyền chia sẻ.
- Một workspace có nhiều thành viên.
- Mỗi thành viên có vai trò riêng trong workspace.
- Mọi hành động nhạy cảm cần được kiểm tra quyền ở cấp tài nguyên.

## 47. Sao lưu và phục hồi

- Sao lưu PostgreSQL.
- Sao lưu Object Storage.
- Mã hóa bản sao lưu.
- Kiểm tra tính nhất quán giữa metadata và ciphertext.
- Kiểm thử khôi phục trên môi trường độc lập.
- Quản lý quyền sao lưu.
- Xác định RPO và RTO.
- Có phương án phục hồi khi mất máy chủ hoặc cơ sở dữ liệu.

---

# PHẦN VII. BẢO MẬT HỆ THỐNG

## 48. Mô hình đe dọa

| Nguy cơ | Giải pháp |
|---|---|
| Chiếm tài khoản | MFA, kiểm soát phiên |
| Giả mạo khóa | Xác minh fingerprint |
| Rò rỉ PostgreSQL | Không lưu secret key dạng rõ |
| Rò rỉ Object Storage | Chỉ lưu ciphertext |
| SQL Injection | Validation và truy vấn tham số hóa |
| IDOR/BOLA | Authorization theo tài nguyên |
| XSS | CSP, kiểm soát nội dung |
| CSRF | Cookie policy và cơ chế chống CSRF |
| Trùng nonce | Bộ đếm và giới hạn theo thiết kế |
| Sửa ciphertext | AES-GCM |
| Thay đổi manifest | ML-DSA |
| Sai khóa | Kiểm tra và từ chối giải mã |
| Truy cập vượt quyền | RBAC + Resource-Based |
| Tấn công DoS | Rate limit, quota |
| Lạm quyền quản trị | Phân tách trách nhiệm, audit log |
| Mất khóa bí mật | Backup và recovery |
| Thay mã Frontend | Kiểm soát chuỗi cung ứng và phát hành |

## 49. Bảo mật Backend

- Xác thực mọi API cần bảo vệ.
- MFA.
- Rate limiting.
- Kiểm tra dữ liệu đầu vào.
- Kiểm soát CORS.
- Phòng chống CSRF.
- Chặn IDOR/BOLA.
- Kiểm tra quyền ở Service/Policy layer.
- Không tin tưởng thông tin phân quyền do Frontend gửi.
- Không trả stack trace hoặc secret.
- Quản lý session và cookie an toàn.
- Quản lý secret dịch vụ.
- Kiểm soát upload và download.
- Hạn chế tài nguyên.

## 50. Bảo mật PostgreSQL

- Không công khai cổng database.
- Không dùng superuser cho nghiệp vụ.
- Tách quyền migration.
- Tách role ứng dụng và worker.
- Kiểm soát kết nối.
- Sử dụng TLS khi cần.
- Kiểm tra backup.
- Kiểm tra restore.
- Kiểm thử RLS nếu áp dụng.
- Giám sát truy vấn bất thường.
- Quản lý credential an toàn.

## 51. Bảo mật Object Storage

- Bucket private.
- Không cấp quyền đọc công khai.
- URL upload/download có thời hạn.
- Kiểm soát object key.
- Kiểm soát kích thước.
- Không sử dụng tên tệp gốc làm đường dẫn lưu trữ.
- Kiểm tra quyền trước khi tải.
- Dọn dữ liệu tạm.
- Kiểm tra checksum.
- Ghi nhận sự kiện truy cập.

## 52. Bảo mật khóa

- Sinh khóa tại thiết bị.
- Không gửi private key dạng rõ tới Backend.
- Không ghi private key vào log.
- Bảo vệ backup bằng Argon2id và mã hóa xác thực.
- Không lưu mật khẩu bảo vệ khóa.
- Xác minh fingerprint.
- Bảo vệ khi thay đổi khóa công khai.
- Tách khóa ML-KEM và ML-DSA.
- Có quy trình thu hồi và thay đổi khóa.
- Không tự động cấp khả năng giải mã cho Admin.

## 53. Nhật ký và giám sát

Theo dõi:

- Đăng nhập thất bại.
- Đăng nhập bất thường.
- Thay đổi vai trò.
- Gán quyền quản trị.
- Thay đổi quyền nhóm.
- Thay đổi khóa công khai.
- Tải xuống bất thường.
- Tạo liên kết chia sẻ.
- Lỗi API.
- Lỗi PostgreSQL.
- Lỗi Object Storage.
- Sự cố hàng đợi.
- Thao tác quản trị nhạy cảm.

Nhật ký cần được bảo vệ khỏi chỉnh sửa trái phép và có chính sách lưu giữ phù hợp.

---

# PHẦN VIII. KIỂM THỬ VÀ ĐẢM BẢO CHẤT LƯỢNG

## 54. Kiểm thử chức năng

| Mã | Nội dung |
|---|---|
| FT-01 | Đăng ký |
| FT-02 | Xác minh email |
| FT-03 | Đăng nhập |
| FT-04 | MFA |
| FT-05 | Quản lý phiên |
| FT-06 | Quản lý hồ sơ |
| FT-07 | Vai trò hệ thống |
| FT-08 | Phân quyền tài nguyên |
| FT-09 | Phân quyền nhóm |
| FT-10 | Tạo khóa ML-KEM |
| FT-11 | Tạo khóa ML-DSA |
| FT-12 | Sao lưu/khôi phục khóa |
| FT-13 | Mã hóa |
| FT-14 | Giải mã |
| FT-15 | Upload |
| FT-16 | Download |
| FT-17 | Quản lý tệp |
| FT-18 | Quản lý thư mục |
| FT-19 | Chia sẻ |
| FT-20 | Thu hồi quyền |
| FT-21 | Chữ ký số |
| FT-22 | Quản lý workspace |
| FT-23 | Thông báo |
| FT-24 | Audit log |
| FT-25 | Quản trị người dùng |
| FT-26 | Quản trị hệ thống |

## 55. Kiểm thử vai trò và quyền

Các trường hợp bắt buộc:

- Khách không truy cập Dashboard riêng tư.
- Người dùng không truy cập API quản trị.
- Người dùng A không đọc metadata riêng tư của B.
- Người dùng A không tải tệp của B khi chưa có quyền.
- Người dùng có quyền tải ciphertext nhưng không có khóa không thể giải mã.
- Viewer không tạo bản sửa đổi.
- Uploader không đọc tài liệu ngoài phạm vi.
- Editor không tự động được cấp quyền quản trị nhóm.
- Workspace Admin không tự ý chuyển quyền sở hữu.
- Workspace Owner không truy cập nhóm khác.
- Support không xem private key.
- Auditor không sửa audit log.
- System Admin không mặc nhiên giải mã tài liệu.
- Thu hồi quyền khiến các yêu cầu tải mới bị từ chối.
- Thay đổi UUID trong API không vượt qua quyền.
- Thay đổi vai trò được ghi nhận.
- Phiên bị thu hồi không tiếp tục truy cập.
- Tài khoản bị khóa không tiếp tục sử dụng API được bảo vệ.

## 56. Kiểm thử mật mã

- Kiểm tra ML-KEM theo bộ dữ liệu chuẩn.
- Kiểm tra encapsulation/decapsulation.
- Kiểm tra HKDF.
- Kiểm tra AES-GCM.
- Kiểm tra AAD.
- Kiểm tra tính duy nhất của nonce.
- Kiểm tra ML-DSA.
- Kiểm tra chữ ký sai.
- Kiểm tra khóa sai.
- Kiểm tra ciphertext bị sửa.
- Kiểm tra header sai.
- Kiểm tra dữ liệu thiếu.
- Kiểm tra các record bị đảo hoặc lặp.
- Kiểm tra dữ liệu thừa.
- Kiểm tra tệp rỗng.
- Kiểm tra tệp dung lượng lớn.
- Kiểm tra khôi phục khóa trên thiết bị khác.
- Kiểm tra thêm và thu hồi người nhận.

## 57. Kiểm thử PostgreSQL

- Migration.
- Khóa chính.
- Khóa ngoại.
- Unique constraints.
- Transaction.
- Rollback.
- Pagination.
- Indexes.
- Quyền truy cập bản ghi.
- RLS nếu triển khai.
- Tính nhất quán metadata/object.
- Backup.
- Restore.
- Connection pool.
- Truy vấn đồng thời.

## 58. Kiểm thử API

- Authentication.
- Authorization.
- Validation.
- Rate limit.
- Error handling.
- Pagination.
- Filtering.
- Upload lifecycle.
- Download authorization.
- Sharing permissions.
- Session revocation.
- Kiểm tra cấu hình cookie.
- Kiểm tra giới hạn dữ liệu.
- Kiểm tra xử lý request trùng lặp.

## 59. Kiểm thử bảo mật

- SQL Injection.
- XSS.
- CSRF.
- IDOR/BOLA.
- Broken Access Control.
- Broken Authentication.
- Session Hijacking.
- Session Fixation.
- Brute Force.
- Path Traversal.
- File Upload Abuse.
- Malformed Input.
- Parser Fuzzing.
- Dependency Vulnerabilities.
- Secret Leakage.
- Replay Attacks.
- Resource Exhaustion.
- Privilege Escalation.

## 60. Kiểm thử giao diện

- Chrome.
- Firefox.
- Edge.
- Safari.
- Desktop.
- Tablet.
- Mobile.
- Dark mode.
- Responsive.
- Keyboard navigation.
- Accessibility.
- Loading states.
- Error handling.
- Progress bar.
- Hủy thao tác.
- Mất kết nối.
- Khôi phục thao tác khi được hỗ trợ.

## 61. Tiêu chí nghiệm thu

Sản phẩm phải đáp ứng:

**Tài khoản và phân quyền**

- Đăng ký, đăng nhập, MFA hoạt động.
- Các vai trò có quyền chính xác.
- Không xảy ra truy cập vượt quyền trong bộ kiểm thử.
- Quản lý nhóm hoạt động.
- Nhật ký ghi nhận thay đổi vai trò.

**Mật mã**

- Tạo và bảo vệ khóa.
- Mã hóa, giải mã đúng.
- Sao lưu và khôi phục khóa.
- Phát hiện dữ liệu bị chỉnh sửa.
- Chữ ký số hoạt động.
- Không có cơ chế mặc định cho phép Backend giải mã nội dung người dùng.

**Quản lý dữ liệu**

- Upload/download ciphertext.
- Quản lý tệp và thư mục.
- Chia sẻ nhiều người nhận.
- Thu hồi quyền truy cập máy chủ.
- Quản lý bản sửa đổi.
- Sao lưu và phục hồi dữ liệu dịch vụ.

**Hệ thống**

- Frontend hoạt động ổn định.
- Backend có kiểm soát quyền.
- PostgreSQL có ràng buộc toàn vẹn.
- Object Storage được bảo vệ.
- Có kiểm thử tự động.
- Có giám sát và nhật ký.
- Có tài liệu API và cấu hình.
- Có quy trình xử lý lỗi và sự cố.
- Hoàn thành đánh giá bảo mật phù hợp trước khi sử dụng với dữ liệu nhạy cảm.

---

**KẾT THÚC TÀI LIỆU — PHẦN I ĐẾN PHẦN VIII**
