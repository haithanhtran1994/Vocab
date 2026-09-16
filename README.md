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

## 6. Dùng file audio thu sẵn cho câu ví dụ (tùy chọn)

Nếu đã có file `.wav`/`.mp3` thu sẵn cho câu ví dụ, thêm cột **`audio`** vào sheet
`CauVi` (hoặc sheet phụ tương đương) trong Excel, điền đường dẫn file đó **tính
từ gốc repo private**, ví dụ:

```
audio/N2_vocab/1.wav
```

Rồi tự upload các file `.wav` đó vào đúng đường dẫn trong repo private (qua
giao diện web GitHub, hoặc `git push` bình thường — phần này app không tự làm
thay, chỉ đọc/phát file đã có sẵn).

- Có `audio` → app tải file qua GitHub API (repo private nên cần xác thực
  bằng token, không dùng được link công khai) rồi phát trực tiếp, có cache lại
  trong phiên học để không tải lại nhiều lần. Nút 🔊 sẽ đổi thành 🎧 để biết
  dòng đó có audio thu sẵn.
- Không điền `audio` (để trống) → app dùng giọng đọc trình duyệt như bình
  thường, không có gì thay đổi.
- Tải/phát file lỗi (sai đường dẫn, file bị xoá...) → tự động rơi về giọng đọc
  trình duyệt, không làm đứng app.

File audio không giới hạn kích thước theo cách cũ (~1MB của base64-JSON) vì
app lấy qua chế độ "raw" của GitHub API, hỗ trợ tới 100MB/file — quá đủ cho
audio 1 câu ví dụ ngắn.

## 7. Giới hạn cần biết

- **Rate limit**: GitHub API cho phép 5000 request có xác thực/giờ — thoải
  mái cho dùng cá nhân.
- **Lịch sử commit**: `progress.json` sẽ có khá nhiều commit theo thời gian
  (dù đã debounce). Không ảnh hưởng gì tới việc dùng, chỉ là repo sẽ có
  nhiều lịch sử — có thể thỉnh thoảng "squash" nếu muốn gọn.
- **Bảo mật token**: ai lấy được token từ trình duyệt của mày (DevTools →
  Application → Local Storage) sẽ ghi được vào đúng repo đó. Dùng
  fine-grained token giới hạn 1 repo để giảm rủi ro, và thu hồi token nếu
  nghi ngờ lộ.
