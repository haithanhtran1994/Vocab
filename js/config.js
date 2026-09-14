// ============================================================
// CONFIG.js — cấu hình mặc định của app.
// Có thể sửa trực tiếp ở đây (owner/repo/branch) rồi commit,
// HOẶC để nguyên và nhập trong màn hình "Cài đặt GitHub" trong app
// (giá trị nhập trong app được lưu ở localStorage, không cần sửa file này).
// TUYỆT ĐỐI KHÔNG bao giờ điền Personal Access Token vào file này
// vì file này sẽ được commit công khai lên repo.
// ============================================================
window.CONFIG = {
  github: {
    owner: 'YOUR_GITHUB_USERNAME',   // ví dụ: 'haitt'
    repo: 'YOUR_REPO_NAME',          // ví dụ: 'vocab-master-pro'
    branch: 'main',
    vocabPath: 'data/vocab.json',
    progressPath: 'data/progress.json'
  },
  // Không commit-per-thao-tác: gom lại rồi mới lưu để tránh spam commit.
  autosaveDebounceMs: 8000,     // sau 8s không thao tác gì thêm -> tự lưu tiến độ
  autosaveMinIntervalMs: 20000  // tối thiểu 20s giữa 2 lần tự lưu
};
