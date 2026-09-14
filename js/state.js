// ============================================================
// state.js — dữ liệu toàn cục của app + logic load/save GitHub
// ============================================================

let vocab = { headers: [], rows: [], sheets: {} };
let progress = {
  stats: {}, current_index: 0, field_order: null,
  hidden_columns: { study: [], review: [] },
  quiz_scenarios: [], furigana: false,
  volumes: { jp: 0.8, vi: 1.0, en: 0.9 }
};
let vocabSha = null, progressSha = null;
let allFields = [];

let currentMode = 'study';
let currentWordIndex = 0, currentFieldIndex = 1;
let reviewPool = [], reviewIndex = 0;

let _dirtyProgress = false;
let _saveTimer = null;
let _lastSaveTime = 0;
let _savingInFlight = false;

const cleanStr = s => String(s == null ? '' : s).replace(/\\n/g, '\n');

// ── LOAD ──
async function loadAllFromGitHub() {
  const vRes = await ghGetFile(CONFIG.github.vocabPath);
  if (!vRes.content) {
    throw new Error(`Không tìm thấy ${CONFIG.github.vocabPath} trên GitHub. Hãy tạo file này trong repo trước (xem README.md).`);
  }
  vocab = Object.assign({ headers: [], rows: [], sheets: {} }, vRes.content);
  vocabSha = vRes.sha;

  const pRes = await ghGetFile(CONFIG.github.progressPath);
  if (pRes.content) {
    progress = Object.assign(progress, pRes.content);
    progressSha = pRes.sha;
  } else {
    progressSha = null; // sẽ được tạo mới ở lần lưu đầu tiên
  }
  currentWordIndex = progress.current_index || 0;
  buildAllFields();
}

function buildAllFields() {
  if (!vocab.headers.length) { allFields = []; return; }
  const def = vocab.headers.map(h => ({ type: 'vocab', key: h }));
  Object.keys(vocab.sheets || {}).forEach(sn => def.push({ type: 'sheet', key: sn }));
  if (progress.field_order && progress.field_order.length) {
    const STT = def[0], rest = def.slice(1), ordered = [];
    progress.field_order.forEach(k => { const f = rest.find(f => f.key === k); if (f) ordered.push(f); });
    rest.forEach(f => { if (!ordered.find(o => o.key === f.key)) ordered.push(f); });
    allFields = [STT, ...ordered];
  } else {
    allFields = def;
  }
  if (currentFieldIndex >= allFields.length || currentFieldIndex < 1) currentFieldIndex = 1;
}

// ── SAVE: PROGRESS (debounced, tránh spam commit) ──
function markProgressDirty() {
  _dirtyProgress = true;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveProgressToGitHub(), CONFIG.autosaveDebounceMs);
}

async function saveProgressToGitHub(force) {
  if (!_dirtyProgress && !force) return;
  if (_savingInFlight) { clearTimeout(_saveTimer); _saveTimer = setTimeout(() => saveProgressToGitHub(force), 2000); return; }
  const now = Date.now();
  if (!force && now - _lastSaveTime < CONFIG.autosaveMinIntervalMs) {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => saveProgressToGitHub(), CONFIG.autosaveMinIntervalMs - (now - _lastSaveTime));
    return;
  }
  progress.current_index = currentWordIndex;
  _savingInFlight = true;
  setSyncStatus('saving');
  try {
    const res = await ghPutFile(CONFIG.github.progressPath, progress, progressSha, '📈 Cập nhật tiến độ học tập');
    progressSha = res.content.sha;
    _dirtyProgress = false; _lastSaveTime = Date.now();
    setSyncStatus('saved');
  } catch (err) {
    if (err.status === 409) {
      try {
        const fresh = await ghGetFile(CONFIG.github.progressPath);
        progressSha = fresh.sha;
        const res = await ghPutFile(CONFIG.github.progressPath, progress, progressSha, '📈 Cập nhật tiến độ học tập');
        progressSha = res.content.sha; _dirtyProgress = false; _lastSaveTime = Date.now();
        setSyncStatus('saved');
      } catch (e2) { setSyncStatus('error', e2.message); }
    } else {
      setSyncStatus('error', err.message);
    }
  } finally { _savingInFlight = false; }
}

// ── SAVE: VOCAB (ghi ngay khi người dùng sửa dữ liệu từ vựng) ──
async function saveVocabToGitHub(message) {
  setSyncStatus('saving');
  try {
    const res = await ghPutFile(CONFIG.github.vocabPath, vocab, vocabSha, message || '✏️ Cập nhật dữ liệu từ vựng');
    vocabSha = res.content.sha;
    setSyncStatus('saved');
    return true;
  } catch (err) {
    if (err.status === 409) {
      const fresh = await ghGetFile(CONFIG.github.vocabPath);
      vocabSha = fresh.sha;
      const res = await ghPutFile(CONFIG.github.vocabPath, vocab, vocabSha, message || '✏️ Cập nhật dữ liệu từ vựng');
      vocabSha = res.content.sha;
      setSyncStatus('saved');
      return true;
    }
    setSyncStatus('error', err.message);
    alert('Lỗi lưu lên GitHub: ' + err.message);
    return false;
  }
}

// Lưu ngay khi rời trang / ẩn tab, cố gắng hết sức (không đảm bảo 100%)
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && _dirtyProgress) saveProgressToGitHub(true);
});
window.addEventListener('beforeunload', () => {
  if (_dirtyProgress) saveProgressToGitHub(true);
});
