// ============================================================
// edit.js — sửa trực tiếp trên thẻ học (từ vựng hoặc câu ví dụ)
// Lưu thay đổi ngược lại vocab.json trên GitHub.
// ============================================================

let isEditing = false, editOriginalText = '', editingSheetItems = null;

function enterEditMode() {
  if (isEditing) return;
  stopSpeech(); stopAutoPlay();
  const f = allFields[currentFieldIndex];
  if (f && f.type === 'sheet') enterSheetJpEditMode(f.key);
  else enterVocabEditMode();
}
function enterVocabEditMode() {
  isEditing = true;
  const el = document.getElementById('display-text');
  editOriginalText = el.innerText;
  el.setAttribute('contenteditable', 'true'); el.focus();
  el.style.userSelect = 'text'; el.style.webkitUserSelect = 'text'; el.style.cursor = 'text';
  disableSwipe();
  showEditPopup([{ label: '💾 Lưu', color: 'var(--success)', fn: 'saveVocabEdit()' }, { label: '❌ Hủy', color: '#94a3b8', fn: 'cancelVocabEdit()' }]);
}
function enterSheetJpEditMode(sheetName) {
  isEditing = true; disableSwipe();
  const jpLines = document.querySelectorAll('.jp-line');
  editingSheetItems = [];
  jpLines.forEach(span => {
    const rowIdx = parseInt(span.getAttribute('data-row-idx'));
    const jpTextEl = span.querySelector('.jp-text');
    editingSheetItems.push({ rowIdx, originalJp: jpTextEl?.innerText.trim() || '' });
    if (jpTextEl) { jpTextEl.setAttribute('contenteditable', 'true'); jpTextEl.style.userSelect = 'text'; jpTextEl.style.webkitUserSelect = 'text'; jpTextEl.style.outline = 'none'; jpTextEl.style.cursor = 'text'; }
    span.setAttribute('data-editing', 'true');
  });
  if (jpLines.length) { const firstText = jpLines[0].querySelector('.jp-text'); if (firstText) firstText.focus(); }
  showEditPopup([{ label: '💾 Lưu jp', color: 'var(--success)', fn: 'saveSheetJpEdit()' }, { label: '❌ Hủy', color: '#94a3b8', fn: 'cancelSheetJpEdit()' }]);
}
function showEditPopup(buttons) {
  const container = document.getElementById('display-text').parentElement;
  const old = document.getElementById('edit-popup'); if (old) old.remove();
  const popup = document.createElement('div'); popup.id = 'edit-popup';
  popup.style.cssText = 'position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:100%;display:flex;justify-content:space-between;padding:0 10px;box-sizing:border-box;z-index:1001;pointer-events:none';
  popup.innerHTML = buttons.map(b => `<button onclick="${b.fn}" style="pointer-events:auto;min-width:90px;background:${b.color};color:white;padding:10px;border-radius:8px;font-weight:bold;box-shadow:0 4px 6px rgba(0,0,0,.2)">${b.label}</button>`).join('');
  container.style.position = 'relative'; container.appendChild(popup);
}
async function saveVocabEdit() {
  const el = document.getElementById('display-text'); const newValue = el.innerText.trim();
  const word = currentMode === 'study' ? vocab.rows[currentWordIndex] : reviewPool[reviewIndex];
  let fieldName = '';
  vocab.headers.forEach(h => { if (cleanStr(word[h]) === editOriginalText) fieldName = h; });
  if (!fieldName) { const cf = allFields[currentFieldIndex]; fieldName = (cf && cf.type === 'vocab') ? cf.key : vocab.headers[1] || vocab.headers[0]; }
  word[fieldName] = newValue;
  const ok = await saveVocabToGitHub(`✏️ Sửa "${fieldName}" của ${word[vocab.headers[0]]}`);
  if (ok) { exitEditMode(); updateDisplay(true); }
}
function cancelVocabEdit() { document.getElementById('display-text').innerText = editOriginalText; exitEditMode(); }
async function saveSheetJpEdit() {
  if (!editingSheetItems) return;
  const sheetName = allFields[currentFieldIndex]?.key; if (!sheetName) { exitEditMode(); return; }
  document.querySelectorAll('.jp-line[data-editing]').forEach((span, i) => {
    const info = editingSheetItems[i]; if (!info) return;
    const jpTextEl = span.querySelector('.jp-text');
    const newJp = (jpTextEl ? jpTextEl.innerText : span.innerText).trim();
    if (vocab.sheets[sheetName] && vocab.sheets[sheetName][info.rowIdx] !== undefined) vocab.sheets[sheetName][info.rowIdx].jp = newJp;
  });
  const ok = await saveVocabToGitHub(`✏️ Sửa câu ví dụ (${sheetName})`);
  if (ok) { exitEditMode(); updateDisplay(true); }
}
function cancelSheetJpEdit() { exitEditMode(); updateDisplay(); }
function exitEditMode() {
  isEditing = false; editOriginalText = ''; editingSheetItems = null;
  const el = document.getElementById('display-text');
  el.removeAttribute('contenteditable'); el.style.userSelect = ''; el.style.webkitUserSelect = ''; el.style.cursor = '';
  document.querySelectorAll('.jp-line[data-editing]').forEach(span => {
    span.removeAttribute('data-editing');
    const jpTextEl = span.querySelector('.jp-text');
    if (jpTextEl) { jpTextEl.removeAttribute('contenteditable'); jpTextEl.style.userSelect = ''; jpTextEl.style.webkitUserSelect = ''; jpTextEl.style.outline = ''; jpTextEl.style.cursor = ''; }
  });
  enableSwipe();
  const popup = document.getElementById('edit-popup'); if (popup) popup.remove();
}
