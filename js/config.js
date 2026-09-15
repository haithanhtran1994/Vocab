// ============================================================
// CONFIG.js — cấu hình mặc định của app.
// Có thể sửa trực tiếp ở đây (owner/repo/branch) rồi commit,
// HOẶC để nguyên và nhập trong màn hình "Cài đặt GitHub" trong app
// (giá trị nhập trong app được lưu ở localStorage, không cần sửa file này).
// TUYỆT ĐỐI KHÔNG bao giờ điền Personal Access Token vào file này
// vì file này sẽ được commit công khai lên repo.
//
// LƯU Ý: owner/repo ở đây trỏ tới REPO PRIVATE chứa data (vd "Data"),
// KHÔNG phải repo public chứa code app này (vd "Vocab").
// ============================================================
window.CONFIG = {
  github: {
    owner: 'YOUR_GITHUB_USERNAME',   // owner của repo PRIVATE chứa data
    repo: 'YOUR_PRIVATE_DATA_REPO',  // ví dụ: 'Data'
    branch: 'main',
    // Mỗi "bộ từ vựng" là 1 thư mục trong repo private, chứa vocab.json
    // (+ progress.json, tự tạo khi lưu tiến độ lần đầu nếu chưa có).
    // defaultFolder là thư mục được load khi mở app lần đầu (chưa chọn gì).
    defaultFolder: 'vocab-data'
  },
  // Không commit-per-thao-tác: gom lại rồi mới lưu để tránh spam commit.
  autosaveDebounceMs: 8000,     // sau 8s không thao tác gì thêm -> tự lưu tiến độ
  autosaveMinIntervalMs: 20000  // tối thiểu 20s giữa 2 lần tự lưu
};
