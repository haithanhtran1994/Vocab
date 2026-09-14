// ============================================================
// dbview.js — quản lý dữ liệu: xem/sửa bảng, nhập từ .xlsx,
// backup/restore JSON. Mọi thay đổi được đẩy lên vocab.json (GitHub).
// ============================================================

let isDataChanged = false;

// ── DB VIEW (bảng kiểu Excel) ──
function showDatabaseView() {
  isDataChanged = false;
  document.getElementById('study-screen').classList.add('hidden');
  document.getElementById('db-view-screen').classList.remove('hidden');
  renderExcelTable();
}
function renderExcelTable() {
  const thead = document.getElementById('excel-thead'), tbody = document.getElementById('excel-tbody');
  thead.innerHTML = ''; tbody.innerHTML = '';
  let trH = document.createElement('tr');
  vocab.headers.forEach(h => { let th = document.createElement('th'); th.innerText = h; trH.appendChild(th); });
  let thA = document.createElement('th'); thA.innerText = 'Thao tác'; trH.appendChild(thA); thead.appendChild(trH);
  vocab.rows.forEach(row => {
    let tr = document.createElement('tr');
    vocab.headers.forEach(h => { let td = document.createElement('td'); td.contentEditable = 'true'; td.innerText = row[h] || ''; td.oninput = () => { isDataChanged = true; }; tr.appendChild(td); });
    let tdA = document.createElement('td'); tdA.style.textAlign = 'center'; tdA.innerHTML = `<button class="btn-delete-row" onclick="deleteExcelRow(this)">Xóa</button>`; tr.appendChild(tdA);
    tbody.appendChild(tr);
  });
}
function deleteExcelRow(btn) { if (confirm('Xóa hàng?')) { btn.closest('tr').remove(); isDataChanged = true; } }
function addRowToExcel() {
  const tbody = document.getElementById('excel-tbody'); let tr = document.createElement('tr');
  vocab.headers.forEach(() => { let td = document.createElement('td'); td.contentEditable = 'true'; td.oninput = () => { isDataChanged = true; }; tr.appendChild(td); });
  let tdA = document.createElement('td'); tdA.style.textAlign = 'center'; tdA.innerHTML = `<button class="btn-delete-row" onclick="deleteExcelRow(this)">Xóa</button>`; tr.appendChild(tdA);
  tbody.appendChild(tr); isDataChanged = true;
}
async function saveExcelChanges() {
  if (isDataChanged && !confirm('Lưu và ghi lên GitHub?')) return;
  const rows = document.querySelectorAll('#excel-tbody tr'); let nd = [];
  rows.forEach(tr => { let obj = {}; const cells = tr.querySelectorAll('td'); vocab.headers.forEach((h, i) => { obj[h] = cells[i] ? cells[i].innerText.trim() : ''; }); if (Object.values(obj).some(v => v !== '')) nd.push(obj); });
  vocab.rows = nd;
  const ok = await saveVocabToGitHub('📊 Sửa bảng dữ liệu từ vựng');
  if (ok) { isDataChanged = false; alert('Đã lưu lên GitHub!'); buildAllFields(); exitDatabaseView(); updateDisplay(); }
}
function exitDatabaseView() {
  if (isDataChanged && confirm('Chưa lưu, lưu trước?')) { saveExcelChanges(); return; }
  document.getElementById('db-view-screen').classList.add('hidden');
  document.getElementById('study-screen').classList.remove('hidden');
}

// ── NẠP / GHI ĐÈ TOÀN BỘ TỪ FILE XLSX ──
// (dùng khi muốn nạp lại toàn bộ vocab.json từ 1 file Excel gốc)
function triggerReplaceFromXlsx() { document.getElementById('replaceXlsxInput').click(); }
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('replaceXlsxInput');
  if (el) el.addEventListener('change', e => handleXlsxFile(e.target.files[0], 'replace'));
  const el2 = document.getElementById('addWordsFileInput');
  if (el2) { /* bound via confirmAddFromFile() button, see below */ }
});

function parseXlsxWorkbook(wb) {
  const sheetNames = wb.SheetNames;
  const vocabSN = sheetNames.find(n => n.toLowerCase() === 'vocab') || sheetNames[0];
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[vocabSN], { defval: 'N.A' });
  if (!rawRows.length) throw new Error('Sheet vocab trống!');
  const headers = Object.keys(rawRows[0]);
  const rows = rawRows.map(row => { let o = {}; headers.forEach(h => { o[h] = cleanStr(row[h]); }); return o; });
  const sheets = {};
  sheetNames.forEach(sn => {
    if (sn === vocabSN) return;
    const rr = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
    if (!rr.length) return;
    const keys = Object.keys(rr[0]);
    const find = c => keys.find(k => c.includes(k.toLowerCase().trim())) || keys[0];
    const cm = { stt: find(['stt', 'id', 'no', 'số']), idx: find(['idx', 'index']), jp: find(['jp', 'japanese', 'ja', 'kanji', 'từ']), vi: find(['vi', 'vietnamese', 'vn', 'nghĩa', 'nghia', 'meaning', 'dịch']) };
    let lastStt = ''; const items = [];
    rr.forEach(r => {
      const rawStt = r[cm.stt];
      const stt = (rawStt === null || rawStt === undefined || rawStt === '') ? lastStt : String(rawStt);
      if (stt) lastStt = stt;
      const jp = cleanStr(r[cm.jp]), vi = cleanStr(r[cm.vi]);
      if (stt || jp) items.push({ stt, idx: r[cm.idx] || '', jp, vi });
    });
    sheets[sn] = items;
  });
  return { headers, rows, sheets };
}

function handleXlsxFile(file, mode) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const parsed = parseXlsxWorkbook(wb);
      if (mode === 'replace') {
        vocab = parsed;
      } else { // 'append'
        if (parsed.headers.length !== vocab.headers.length) { alert('Số cột không khớp với dữ liệu hiện có!'); return; }
        vocab.rows = [...vocab.rows, ...parsed.rows];
        Object.keys(parsed.sheets).forEach(sn => { vocab.sheets[sn] = vocab.sheets[sn] ? [...vocab.sheets[sn], ...parsed.sheets[sn]] : parsed.sheets[sn]; });
      }
      const ok = await saveVocabToGitHub(mode === 'replace' ? '📥 Nạp lại toàn bộ từ file Excel' : `➕ Thêm ${parsed.rows.length} từ từ file Excel`);
      if (ok) { buildAllFields(); alert('✅ Đã đồng bộ lên GitHub!'); hideAddFromFile(); initAppUI(); }
    } catch (err) { alert('Lỗi đọc file: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

// ── THÊM TỪ TỪ FILE (giữ nguyên dữ liệu cũ) ──
function showAddFromFile() { document.getElementById('add-file-panel').classList.remove('hidden'); }
function hideAddFromFile() { document.getElementById('add-file-panel').classList.add('hidden'); }
function confirmAddFromFile() {
  const fi = document.getElementById('addWordsFileInput'); if (!fi.files.length) { alert('Chọn file!'); return; }
  handleXlsxFile(fi.files[0], 'append');
}

// ── BACKUP JSON (local, tiện di chuyển thủ công nếu cần) ──
function exportFullBackup() {
  if (!vocab.rows.length) { alert('Chưa có dữ liệu!'); return; }
  const blob = new Blob([JSON.stringify({ vocab, progress, export_date: new Date().toLocaleString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `Vocab_Backup_${new Date().toISOString().slice(0, 10)}.json`; a.click();
  URL.revokeObjectURL(url);
}
function importFullBackup(event) {
  const file = event.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('Ghi đè dữ liệu hiện tại (và đẩy lên GitHub) bằng file backup này?')) return;
      if (data.vocab) vocab = data.vocab;
      if (data.progress) progress = Object.assign(progress, data.progress);
      buildAllFields();
      await saveVocabToGitHub('📥 Khôi phục từ file backup JSON');
      await saveProgressToGitHub(true);
      alert('Nhập thành công!'); initAppUI();
    } catch (err) { alert('Lỗi JSON: ' + err.message); }
  };
  reader.readAsText(file);
}

async function resetDatabase() {
  if (!confirm('XÓA SẠCH dữ liệu trên GitHub? Không hoàn tác được (nhưng lịch sử commit vẫn còn trên GitHub nếu cần khôi phục)!')) return;
  vocab = { headers: [], rows: [], sheets: {} };
  progress = { stats: {}, current_index: 0, field_order: null, hidden_columns: { study: [], review: [] }, quiz_scenarios: [], furigana: false, volumes: { jp: 0.8, vi: 1.0, en: 0.9 } };
  try {
    await saveVocabToGitHub('🗑️ Xóa sạch dữ liệu');
    await saveProgressToGitHub(true);
    alert('Đã xóa.'); location.reload();
  } catch (err) { alert('Lỗi: ' + err.message); }
}
