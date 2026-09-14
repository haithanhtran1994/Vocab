# Vocab Master Pro — bản dùng GitHub làm "backend"

Thay vì Supabase, app này đọc/ghi trực tiếp 2 file JSON trong một repo GitHub
bằng **GitHub Contents API**:

- `data/vocab.json` — dữ liệu từ vựng (headers, rows, sheets phụ = câu ví dụ)
- `data/progress.json` — tiến độ học (trạng thái học/thuộc, cột ẩn/hiện,
  kịch bản trắc nghiệm, âm lượng, furigana...)

## 1. Chuẩn bị repo trên GitHub

1. Tạo (hoặc dùng) một repo, ví dụ `vocab-master-pro`.
2. Commit toàn bộ các file trong bộ này vào repo, giữ nguyên cấu trúc thư mục:
   ```
   index.html
   css/style.css
   js/config.js
   js/github-api.js
   js/state.js
   js/ui-render.js
   js/speech.js
   js/edit.js
   js/quiz.js
   js/dbview.js
   js/main.js
   data/vocab.json
   data/progress.json
   ```
3. (Tuỳ chọn) Bật **GitHub Pages** cho repo (Settings → Pages → Deploy from
   branch → chọn nhánh/`root`) để có 1 URL học từ điện thoại/máy tính bất kỳ,
   không cần mở file cục bộ.
4. Sửa `data/vocab.json` để chứa dữ liệu từ vựng thật của mày (giữ đúng cấu
   trúc `headers` / `rows` / `sheets` như file mẫu), hoặc dùng nút
   **"📥 Nạp lại toàn bộ từ .xlsx"** trong app để nạp từ file Excel gốc rồi
   app tự ghi vào `vocab.json` giúp.

## 2. Tạo Personal Access Token (PAT)

Vì GitHub không cho ghi ẩn danh, app cần 1 token để **lưu** dữ liệu (đọc thì
không bắt buộc với repo public, nhưng nên có luôn để tránh giới hạn rate).

- Vào GitHub → **Settings → Developer settings → Personal access tokens →
  Fine-grained tokens → Generate new token**.
- **Repository access**: chỉ chọn đúng repo `vocab-master-pro` (không chọn
  "All repositories").
- **Permissions**: `Contents` → **Read and write**. Không cần quyền nào khác.
- Copy token (dạng `github_pat_...`), token chỉ hiện 1 lần.

⚠️ Token này có quyền ghi vào repo đó. Không dán vào `config.js` (file sẽ bị
commit công khai). App sẽ hỏi và lưu token trong `localStorage` của trình
duyệt mày đang dùng — mỗi trình duyệt/thiết bị cần nhập lại 1 lần.

## 3. Dùng app

Mở `index.html` (hoặc URL GitHub Pages) → nhập **Owner / Repo / Branch /
Token** ở màn hình kết nối → **Kết nối & Tải dữ liệu**. Lần sau mở lại, app
tự nhớ Owner/Repo/Branch (và token) nên tự kết nối luôn.

Có thể sửa sẵn Owner/Repo/Branch mặc định trong `js/config.js` để khỏi phải
nhập lại mỗi lần đổi trình duyệt (KHÔNG điền token vào đó).

## 4. Cách lưu tiến độ hoạt động

Để tránh mỗi lần chuyển từ/đánh dấu học đều tạo 1 commit trên GitHub (spam
lịch sử commit), app **gom các thay đổi tiến độ lại** và tự lưu:

- Sau **8 giây** không thao tác gì thêm (debounce).
- Tối thiểu cách nhau **20 giây** giữa 2 lần lưu.
- Lưu ngay khi rời tab / đóng trang (best-effort, không đảm bảo 100% nếu tắt
  app đột ngột — nếu quan trọng, chờ thấy chữ "✅ Đã lưu" ở góc trên trước
  khi thoát).

Riêng khi **sửa dữ liệu từ vựng** (edit trực tiếp trên thẻ, sửa bảng DB, thêm
từ từ file Excel) thì app ghi lên GitHub **ngay lập tức** vì đây là thao tác
có chủ đích, ít xảy ra liên tục.

## 5. Xung đột khi dùng nhiều thiết bị

Nếu mày mở app trên 2 thiết bị cùng lúc và cả hai đều lưu, app sẽ tự phát
hiện xung đột (lỗi 409 do sha cũ), tự tải lại bản mới nhất rồi ghi đè lại 1
lần. Đây là kiểu "ai lưu sau thắng" (last-write-wins) — đủ dùng cho 1 người
dùng trên vài thiết bị, không phù hợp nhiều người sửa đồng thời.

## 6. Giới hạn cần biết

- **Rate limit**: GitHub API cho phép 5000 request có xác thực/giờ — thoải
  mái cho dùng cá nhân.
- **Lịch sử commit**: `progress.json` sẽ có khá nhiều commit theo thời gian
  (dù đã debounce). Không ảnh hưởng gì tới việc dùng, chỉ là repo sẽ có
  nhiều lịch sử — có thể thỉnh thoảng "squash" nếu muốn gọn.
- **Bảo mật token**: ai lấy được token từ trình duyệt của mày (DevTools →
  Application → Local Storage) sẽ ghi được vào đúng repo đó. Dùng
  fine-grained token giới hạn 1 repo để giảm rủi ro, và thu hồi token nếu
  nghi ngờ lộ.
