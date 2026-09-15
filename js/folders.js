// ============================================================
// folders.js — chọn / liệt kê / tải lên các "bộ từ vựng".
// Mỗi bộ từ vựng = 1 thư mục trong repo private (vd 'vocab-data',
// 'N2_vocab'), chứa vocab.json (+ progress.json, tự tạo khi lưu
// tiến độ lần đầu nếu thư mục đó chưa có).
// ============================================================

async function openFolderModal() {
  document.getElementById('folder-modal-root').classList.remove('hidden');
  const list = document.getElementById('folder-list');
  list.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:8px 0">Đang tải danh sách...</div>';
  try {
    const folders = await ghListVocabFolders();
    renderFolderList(folders);
  } catch (err) {
    list.innerHTML = `<div style="color:#ef4444;font-size:.85rem;padding:8px 0">Lỗi: ${escapeHtml(err.message)}</div>`;
  }
}
function closeFolderModal() { document.getElementById('folder-modal-root').classList.add('hidden'); }

function renderFolderList(folders) {
  const list = document.getElementById('folder-list');
  const current = ghGetCurrentFolder();
  if (!folders.length) {
    list.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:8px 0">Chưa có thư mục nào trong repo. Tải 1 bộ từ vựng lên ở bên dưới.</div>';
    return;
  }
  list.innerHTML = folders.map(f => {
    const active = f === current;
    return `<button onclick="selectVocabFolder('${f.replace(/'/g, "\\'")}')"
      style="text-align:left;background:${active ? '#eff6ff' : '#f8fafc'};border:1px solid ${active ? 'var(--primary)' : '#e2e8f0'};padding:12px;border-radius:10px;font-weight:bold;color:#1e293b;display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:8px">
      <span>📂 ${escapeHtml(f)}</span>
      ${active ? '<span style="color:var(--primary);font-size:.7rem;font-weight:bold">ĐANG HỌC</span>' : ''}
    </button>`;
  }).join('');
}

async function selectVocabFolder(folderName) {
  if (folderName === ghGetCurrentFolder()) { closeFolderModal(); return; }
  if (_dirtyProgress) await saveProgressToGitHub(true); // chốt tiến độ bộ cũ trước khi rời đi
  closeFolderModal();
  const list = document.getElementById('folder-list');
  try {
    await switchToFolder(folderName);
  } catch (err) {
    alert('Lỗi tải bộ từ vựng "' + folderName + '": ' + err.message);
  }
}

// ── TẢI 1 THƯ MỤC TỪ MÁY LOCAL LÊN GITHUB ──
function triggerUploadLocalFolder() { document.getElementById('localFolderInput').click(); }

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('localFolderInput');
  if (el) el.addEventListener('change', handleLocalFolderUpload);
});

async function handleLocalFolderUpload(e) {
  const files = Array.from(e.target.files || []);
  e.target.value = ''; // cho phép chọn lại đúng thư mục đó ở lần sau
  if (!files.length) return;

  // Tìm file "vocab.json" nằm NGAY trong thư mục gốc được chọn (không phải thư mục con bên trong nó)
  const vocabFile = files.find(f => {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/');
    return parts.length === 2 && parts[1].toLowerCase() === 'vocab.json';
  });
  if (!vocabFile) {
    alert('Không tìm thấy file "vocab.json" ngay trong thư mục đã chọn.\nHãy chọn đúng thư mục (vd "N2_vocab") có chứa file vocab.json ở gốc của nó.');
    return;
  }
  const folderName = vocabFile.webkitRelativePath.split('/')[0];

  let parsed;
  try {
    const text = await vocabFile.text();
    parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) {
      throw new Error('File thiếu "headers" hoặc "rows" hợp lệ (không đúng schema vocab.json).');
    }
  } catch (err) {
    alert('File vocab.json không hợp lệ: ' + err.message);
    return;
  }

  const path = `${folderName}/vocab.json`;
  let existingSha = null;
  try {
    const existing = await ghGetFile(path);
    existingSha = existing.sha;
  } catch (err) {
    alert('Lỗi kiểm tra dữ liệu hiện có trên GitHub: ' + err.message);
    return;
  }

  if (existingSha) {
    const ok = confirm(`⚠️ Thư mục "${folderName}" đã có sẵn vocab.json trên GitHub.\n\nBấm OK để GHI ĐÈ bằng file vừa chọn từ máy, hoặc Cancel để dừng lại (không đổi gì cả).`);
    if (!ok) return;
  }

  try {
    await ghPutFile(
      path, parsed, existingSha,
      existingSha ? `📥 Ghi đè vocab.json (${folderName}) từ máy local` : `📥 Tạo mới bộ từ "${folderName}" từ máy local`
    );
    alert(`✅ Đã ${existingSha ? 'ghi đè' : 'tạo mới'} "${folderName}/vocab.json" trên GitHub.`);
    const switchNow = confirm(`Chuyển sang học bộ từ "${folderName}" luôn không?`);
    if (switchNow) {
      closeFolderModal();
      await selectVocabFolder(folderName);
    } else {
      openFolderModal(); // mở lại modal để thấy danh sách vừa cập nhật
    }
  } catch (err) {
    alert('Lỗi tải lên GitHub: ' + err.message);
  }
}
