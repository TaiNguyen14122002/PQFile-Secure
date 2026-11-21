# PQFile Secure — Xem trước đa định dạng & Markdown Reader (2026)

## Phạm vi

Bản cập nhật chỉ thay đổi `apps/web/pages/files.vue`, thêm `apps/web/utils/local-preview.ts`, cập nhật hai gói `markdown-it` và kiểu TypeScript `@types/markdown-it`. Không thay đổi schema PostgreSQL, API phân quyền, ciphertext, cơ chế ML-KEM/ML-DSA/AES-GCM hoặc mật khẩu kho khóa.

**Luồng an toàn:** API trả về metadata và ciphertext theo quyền → trình duyệt xác minh ML-DSA / giải mã AES-GCM như trước → bộ đọc cục bộ phân tích `Blob` đã giải mã → hiển thị nội dung. Không gửi bản rõ đến máy chủ để chuyển đổi. Luôn phải mở khóa kho khóa trước khi xem.

## Định dạng được xem

| Định dạng | Bản xem trước | Giới hạn |
|---|---|---|
| `.pdf` | Trình xem PDF của trình duyệt | Chữ ký PDF được kiểm tra trước khi mở; phụ thuộc trình xem của thiết bị |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.bmp`, `.avif`, `.ico` | Hình ảnh | Phụ thuộc codec ảnh của trình duyệt; kiểm tra chữ ký cơ bản |
| `.docx` | Văn bản, tiêu đề và bảng Word | Không tái tạo hoàn hảo ảnh, đồ thị, font và bố cục phức tạp |
| `.xlsx` | Bảng dữ liệu, chọn sheet | Tối đa 14 sheet, 200 hàng × 40 cột mỗi sheet; không tính lại công thức, không tái tạo style |
| `.pptx` | Dạng đọc theo từng slide | Tối đa 50 slide; văn bản, chưa tái tạo hình ảnh, hiệu ứng |
| `.odt`, `.ods`, `.odp` | Văn bản trích xuất từ OpenDocument | Không tái tạo bảng phức tạp và bố cục như ứng dụng gốc |
| `.csv`, `.tsv` | Bảng có hàng/cột | Tối đa 250 dòng, 40 cột; 2 MiB đầu tiên |
| `.md`, `.markdown`, `.mdown` | **Markdown Reader** (định dạng) và nút **Mã nguồn Markdown** | Đọc 2 MiB đầu tiên. Không tự tải ảnh bên ngoài, HTML thô được escape |
| `.txt`, `.log`, `.json`, `.xml`, `.yaml`, `.yml`, `.html`, `.svg`, mã nguồn... | Văn bản có xuống dòng, JSON được canh lề | 2 MiB đầu; không chạy script hay nhúng HTML/SVG |
| `.rtf` | Văn bản RTF giản lược | Có thể mất kiểu chữ hoặc ký tự đặc biệt |
| `.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.mp4`, `.webm`, `.mov`... | Audio/video player của trình duyệt | Phụ thuộc codec cài trên máy |
| `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.iso`, `.dmg`... và thư mục | **Không hỗ trợ xem trước** | Có thể tải về nếu có quyền |
| `.doc`, `.xls`, `.ppt`, tệp nhị phân đặc thù | Thông báo giới hạn; tải về bằng app tương ứng | Không chuyển đổi bí mật qua server. Không quảng cáo đã đọc được khi thực tế chưa hỗ trợ |

## Bảo mật

- Bộ đọc không tải tài liệu bản rõ lên backend, AI API hay CDN; `markdown-it` được đóng gói bằng npm trong Docker.
- Markdown sử dụng `html: false`, tắt tự động tải hình Markdown bằng thay thế `image` rule; link bên ngoài chỉ mở khi người dùng chủ động bấm, với `rel="noopener noreferrer nofollow"`.
- Văn bản DOCX/ODT được escape trước khi gắn vào `v-html`; Excel, PowerPoint và TXT sử dụng interpolation Vue; HTML/SVG được xem dưới dạng **văn bản**, không iframed/scripted.
- Bộ đọc ZIP nội bộ cho DOCX/XLSX/PPTX kiểm tra central directory, phương pháp nén, kích thước đầu vào/đầu ra và giới hạn 32 MiB giải nén cho mỗi phiên.
- Blob URL của PDF, ảnh, video và audio được `URL.revokeObjectURL` khi chuyển tệp, đóng viewer hoặc hủy trang.
- Không thay đổi quy trình xác thực chữ ký ML-DSA; file có chữ ký sai vẫn bị từ chối ở bước giải mã trước khi tới preview.

## Cách áp dụng

Lưu file `PQFile_Multi_Format_Preview_Markdown_Reader.patch` trong `/Volumes/Tai_Nguyen_256GB/NCKH/Source/`, mở Terminal ở thư mục mã nguồn dự án `pqfile-secure`, sau đó:

```bash
git apply --check "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Multi_Format_Preview_Markdown_Reader.patch"
git apply "/Volumes/Tai_Nguyen_256GB/NCKH/Source/PQFile_Multi_Format_Preview_Markdown_Reader.patch"
docker compose up -d --build web
```

Chạy lệnh apply thứ hai **chỉ khi** lệnh `--check` không báo lỗi. Mở `http://localhost:8080/files?tab=all` rồi `Command + Shift + R`, mở khóa kho khóa, chọn một tệp và nhấn nút hình con mắt. Có thể chọn toàn màn hình hoặc đổi chế độ Markdown Reader ⇄ Mã nguồn.

## Kiểm tra nên thực hiện trên máy triển khai

1. DOCX có văn bản tiếng Việt và bảng → đọc được; chuỗi `<script>` trong nội dung không được chạy.
2. XLSX gồm nhiều sheet → tab sheet hiển thị đúng; kiểm tra ô dạng shared string.
3. PPTX chứa chữ → hiện các trang chiếu; xem dòng chú thích về giới hạn hình/hiệu ứng.
4. `.md` chứa heading, bảng, code, quote, ảnh liên kết ngoài → hiển thị định dạng; không tải ảnh ngoài; nút Mã nguồn hoạt động.
5. PDF/PNG/JPG/MP4/MP3 → xem hoặc phát cục bộ tùy codec.
6. ZIP → nút xem trước vô hiệu; tệp có chữ ký định dạng giả mạo báo cảnh báo.
7. Kiểm tra cả desktop, tablet, điện thoại với sidebar mở/thu gọn và header cố định.
8. Đổi tệp liên tục và đóng viewer → không xuất hiện nội dung của tệp trước đó.

## Giới hạn kiểm chứng

Đã chạy kiểm thử riêng trên Chromium với DOCX, XLSX (2 sheet), PPTX, CSV, PDF, TXT và các tình huống chặn ZIP/escape HTML; đã kiểm tra TypeScript của bộ đọc. Chưa chạy toàn bộ bản build Nuxt/Docker do môi trường không cài được npm dependencies và chưa chạy thử mở kho khóa với dữ liệu thật trên MacBook của người dùng.
