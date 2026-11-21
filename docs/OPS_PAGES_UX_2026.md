# PQFile Secure — UI/UX 5 trang nghiệp vụ (21/11/2026)

Phạm vi bản vá: `workspaces.vue`, `smart.vue`, `security.vue`, `governance.vue`, `activity.vue`, CSS tách biệt `ops-pages.css` và API `security.controller.ts`. **Không sửa `files.vue`, sidebar, header, schema PostgreSQL, ML-KEM/ML-DSA hoặc kho ciphertext.**

## 1. Nhóm làm việc (`/workspaces`)
- Tạo, đổi tên, xóa nhóm; chỉ OWNER được đổi tên/xóa.
- Thêm thành viên đã đăng ký bằng email; chỉ OWNER/ADMIN có quyền; OWNER mới được cấp vai trò ADMIN.
- Đổi vai trò và xóa thành viên đúng chính sách, thành viên tự rời nhóm được.
- Lọc nhóm theo tên/phạm vi và tìm thành viên theo tên/email/vai trò; xử lý thay đổi nhóm nhanh để tránh dữ liệu trả về sai.
- **Giới hạn:** vai trò thành viên nhóm không tự cấp khóa giải mã hoặc quyền tải tệp. Chia sẻ vẫn cần mã hóa khóa cho người nhận.

## 2. Tìm kiếm & tóm tắt (`/smart`)
- Lấy danh sách tệp được cấp quyền qua `/files/library`; kiểm tra lại quyền trước khi tóm tắt.
- Giải mã trên trình duyệt, tạo chỉ mục AES-GCM trong IndexedDB; hiển thị tình trạng và kết quả tìm kiếm TF-IDF.
- Tóm tắt trích xuất câu/hành động/ngày; thử AI cục bộ của trình duyệt nếu hỗ trợ, không gửi bản rõ lên API.
- Lập chỉ mục từng tệp hoặc mỗi đợt tối đa 20 tệp; hiện tiến độ, dừng giữa các tệp, bỏ qua lỗi trong đợt, thử lại tệp lỗi, xóa chỉ mục cục bộ; lọc/phân trang danh sách.
- **Giới hạn:** tìm kiếm chưa phải embedding semantically-trained; tệp không có lớp văn bản không lập được chỉ mục, cần OCR/bộ giải mã tương thích. Chỉ mục lưu ở thiết bị hiện tại.

## 3. Giám sát an ninh (`/security`)
- API mới `GET /security/alerts/paged` có lọc server-side `page`, `size`, `status`, `severity`, `q`, `from`, `to`; luôn ràng buộc `userId` từ phiên đăng nhập và chỉ hiển thị rủi ro từ 40 điểm.
- API `PATCH /security/alerts/acknowledge-all` đánh dấu tất cả cảnh báo chưa xem xét của **chính tài khoản**; API đánh dấu từng cảnh báo vẫn hoạt động. Hai thao tác có audit log.
- Giao diện KPI, tìm kiếm, lọc mức/trạng thái/thời gian, phân trang, ghi nhận đã xem xét và xử lý lỗi.
- **Giới hạn:** dựa trên ngưỡng, không xác minh danh tính thiết bị và không tự khóa phiên; thao tác đánh dấu không giải quyết nguy cơ thực tế.

## 4. Quản trị quyền (`/governance`)
- Hiển thị quyền đang hiệu lực/đã hết hạn, tìm theo tệp/người nhận, lọc điểm rủi ro, sắp xếp/phân trang trên snapshot, xuất danh sách lọc dạng CSV có chống công thức bảng tính.
- Cập nhật hạn công việc và thu hồi từng quyền; xác nhận trước khi thu hồi. Sơ đồ chủ sở hữu–tệp–người nhận–nhóm có phóng to/thu nhỏ.
- **Giới hạn:** snapshot của API đã giới hạn số tệp/chia sẻ và có cờ `truncated`. Hạn công việc **chỉ** tạo đề xuất; hết hiệu lực thực tế dựa trên `expiresAt` hoặc thu hồi. Tệp đã tải về không bị thu hồi từ xa.

## 5. Nhật ký (`/activity`)
- Lọc server-side theo từ khóa, loại hành động và các khoảng ngày; hỗ trợ ngày bắt đầu/kết thúc tùy chỉnh.
- Phân trang và xuất CSV trang hiện tại hoặc tối đa 1.000 bản ghi mới nhất **phù hợp bộ lọc và thuộc tài khoản đang đăng nhập**. Có xác nhận khi dữ liệu vượt giới hạn.
- Bổ sung tên cho hoạt động quản trị quyền và xác nhận cảnh báo an ninh.

## Cài đặt trên macOS

Tại thư mục gốc `pqfile-secure` sau khi lưu PATCH dưới `/Volumes/Tai_Nguyen_256GB/NCKH/Source`:

```bash
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Operations_5_Pages_Responsive_Functional_2026.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Operations_5_Pages_Responsive_Functional_2026.patch"
docker compose up -d --build api web
docker compose ps
```

Mở `http://localhost:8080` và làm mới cứng bằng Cmd + Shift + R.

### Kiểm thử thủ công khuyến nghị
1. `workspaces`: tạo nhóm > thêm tài khoản đã đăng ký > đổi vai trò > lọc thành viên > tự rời nhóm, xác minh quyền OWNER.
2. `smart`: mở kho khóa > lập chỉ mục TXT/DOCX > tìm kiếm > tóm tắt > xóa chỉ mục > thử tệp không hỗ trợ.
3. `security`: lọc chỉ chưa xem xét > đánh dấu một > đổi tab Đã xem xét > đánh dấu toàn bộ > kiểm tra nhật ký hành động.
4. `governance`: lọc nguy cơ > đặt hạn công việc > thu hồi tệp thử nghiệm > kiểm tra không thể tải mới với tài khoản nhận > xem bản đồ và CSV.
5. `activity`: lọc 7 ngày và tùy chọn khoảng ngày, chuyển trang, xuất CSV, mở CSV để kiểm tra dấu tiếng Việt và ràng buộc tài khoản.

Đừng kiểm thử thao tác **xóa nhóm/thu hồi quyền** trên dữ liệu đang sử dụng thật. Sao lưu dữ liệu trước. Không gửi mật khẩu kho khóa hoặc ảnh chụp chứa mật khẩu vào chat.

### Giới hạn kiểm thử bản phát hành
Đã kiểm tra cú pháp TypeScript, tính cân bằng các thẻ Vue, định tuyến, cấu trúc PATCH và phạm vi tệp thay đổi ở môi trường tạo bản vá. Chưa chạy full `npm install`, `nuxt build`, NestJS integration hoặc PostgreSQL/RustFS Docker vì môi trường build không có các dependency npm và không truy cập được registry. Kiểm thử UI trên thiết bị thật và giao dịch API cần thực hiện trên MacBook.
