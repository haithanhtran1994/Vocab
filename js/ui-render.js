// ============================================================
// ui-render.js — hiển thị thẻ học, điều hướng field, screentip,
// modal ẩn/hiện cột, trạng thái đồng bộ GitHub
// ============================================================

let isFuriganaEnabled = false;
let fieldClickTimer = null;
let screentipTimer = null;
let screentipEditing = false, screentipOriginalVi = '', screentipEditInfo = null;
let volSettings = { jp: 0.8, vi: 1.0, en: 0.9 };

function escapeHtml(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;').replace(/\r/g, '&#13;');
}

// ── SYNC STATUS BADGE ──
function setSyncStatus(state, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  if (state === 'saving') { el.textContent = '⏳ Đang lưu...'; el.style.color = '#ca8a04'; }
  else if (state === 'saved') {
    el.textContent = '✅ Đã lưu';
    el.style.color = '#16a34a';
    clearTimeout(el._t);
    el._t = setTimeout(() => { if (el.textContent === '✅ Đã lưu') el.textContent = ''; }, 3000);
  } else if (state === 'error') { el.textContent = '⚠️ Lỗi: ' + (msg || ''); el.style.color = '#ef4444'; }
  else { el.textContent = ''; }
}

// ── FIELD CONTENT ──
function getFieldContent(word, idx) {
  const f = allFields[idx];
  if (!f) return { isSheet: false, content: '' };
  if (f.type === 'vocab') return { isSheet: false, content: cleanStr(word[f.key] || '') };
  const stt = String(word[vocab.headers[0]]);
  return { isSheet: true, items: (vocab.sheets[f.key] || []).filter(r => String(r.stt) === stt), sheetName: f.key };
}

function formatFurigana(text) {
  if (!text) return '';
  // Cụm phải BẮT ĐẦU bằng 1 ký tự Kanji (một-龠), sau đó cho phép thêm Kanji/Hiragana/
  // Katakana nối tiếp (để bắt trọn từ có đuôi okurigana kiểu "食べる(たべる)") nhưng KHÔNG
  // được bắt đầu bằng Hiragana — nhờ vậy trợ từ đứng ngay trước (vd "を" trong "を送(おく)る")
  // không bị nuốt nhầm vào cụm furigana.
  return text.replace(/([一-龠々][一-龠々ぁ-んァ-ヴーa-zA-Z0-9]*)\(([^)]+)\)/g, (_, k, f) => `<ruby>${k}<rt>${f}</rt></ruby>`);
}
function renderJpHtmlSafe(jp) {
  if (!jp) return '';
  if (isFuriganaEnabled) return formatFurigana(jp).replace(/\n/g, '<br>');
  return escapeHtml(jp.replace(/\(.*?\)/g, '')).replace(/\n/g, '<br>');
}

// ── SCREENTIP (xem nghĩa câu ví dụ) ──
function showScreentip(anchorEl, text) {
  if (screentipEditing) return;
  const tip = document.getElementById('screentip');
  screentipEditInfo = {
    sheetName: anchorEl.getAttribute('data-sheet'),
    rowIdx: parseInt(anchorEl.getAttribute('data-row-idx'))
  };
  tip.textContent = text;
  tip.style.display = 'block';
  positionScreentip(tip, anchorEl);
  clearTimeout(screentipTimer);
  screentipTimer = setTimeout(hideScreentip, 6000);
}
function positionScreentip(tip, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const VW = window.innerWidth, VH = window.innerHeight;
  const maxW = Math.min(VW * 0.85, 360);
  tip.style.maxWidth = maxW + 'px';
  const spaceBelow = VH - rect.bottom - 10, spaceAbove = rect.top - 10;
  const tipH = Math.min(tip.scrollHeight || 200, VH * 0.55);
  let top, left = Math.max(10, Math.min(rect.left, VW - maxW - 10));
  if (spaceBelow >= tipH || spaceBelow >= spaceAbove) top = rect.bottom + 6; else top = rect.top - tipH - 6;
  top = Math.max(10, Math.min(top, VH - tipH - 10));
  tip.style.top = top + 'px'; tip.style.left = left + 'px';
  tip.style.maxHeight = Math.min(VH * 0.55, VH - top - 10) + 'px';
}
function hideScreentip() {
  if (screentipEditing) return;
  document.getElementById('screentip').style.display = 'none';
  clearTimeout(screentipTimer);
}
function enterScreentipEdit() {
  if (screentipEditing || !screentipEditInfo) return;
  screentipEditing = true;
  const tip = document.getElementById('screentip');
  screentipOriginalVi = tip.textContent;
  clearTimeout(screentipTimer);
  tip.setAttribute('contenteditable', 'true'); tip.focus();
  const btnDiv = document.getElementById('screentip-btns');
  btnDiv.classList.remove('hidden');
  const rect = tip.getBoundingClientRect();
  btnDiv.style.top = (rect.bottom + 6) + 'px'; btnDiv.style.left = rect.left + 'px';
  btnDiv.innerHTML = `
    <button onclick="saveScreentipEdit()" style="padding:8px 14px;background:var(--success);color:white;border-radius:8px;font-weight:bold;font-size:.85rem">💾 Lưu</button>
    <button onclick="cancelScreentipEdit()" style="padding:8px 14px;background:#94a3b8;color:white;border-radius:8px;font-weight:bold;font-size:.85rem">❌ Hủy</button>`;
}
async function saveScreentipEdit() {
  const tip = document.getElementById('screentip');
  const newVi = tip.textContent.trim();
  if (screentipEditInfo && newVi !== screentipOriginalVi) {
    const { sheetName, rowIdx } = screentipEditInfo;
    if (vocab.sheets[sheetName] && vocab.sheets[sheetName][rowIdx]) {
      vocab.sheets[sheetName][rowIdx].vi = newVi;
      await saveVocabToGitHub('✏️ Sửa nghĩa câu ví dụ');
      const jpLine = document.querySelector(`.jp-line[data-sheet="${CSS.escape(sheetName)}"][data-row-idx="${rowIdx}"]`);
      if (jpLine) jpLine.setAttribute('data-vi', escapeAttr(newVi));
    }
  }
  exitScreentipEdit();
}
function cancelScreentipEdit() { exitScreentipEdit(); }
function exitScreentipEdit() {
  screentipEditing = false; screentipOriginalVi = '';
  const tip = document.getElementById('screentip');
  tip.removeAttribute('contenteditable');
  document.getElementById('screentip-btns').classList.add('hidden');
  hideScreentip();
}

// ── VOLUME ──
function loadVolumes() {
  volSettings = Object.assign({ jp: 0.8, vi: 1.0, en: 0.9 }, progress.volumes || {});
  applyVolUI();
}
function applyVolUI() {
  const jp = document.getElementById('volJP'), vi = document.getElementById('volVI'), en = document.getElementById('volEN');
  if (!jp) return;
  jp.value = volSettings.jp; document.getElementById('pJP').textContent = Math.round(volSettings.jp * 100) + '%';
  vi.value = volSettings.vi; document.getElementById('pVI').textContent = Math.round(volSettings.vi * 100) + '%';
  en.value = volSettings.en; document.getElementById('pEN').textContent = Math.round(volSettings.en * 100) + '%';
}
function saveVolumes() {
  volSettings = {
    jp: parseFloat(document.getElementById('volJP').value),
    vi: parseFloat(document.getElementById('volVI').value),
    en: parseFloat(document.getElementById('volEN').value)
  };
  progress.volumes = volSettings;
  markProgressDirty();
}
function getVolForLang(lang) {
  if (lang === 'ja-JP') return volSettings.jp;
  if (lang === 'vi-VN') return volSettings.vi;
  return volSettings.en;
}
function toggleVolPopup(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('vol-popup');
  if (pop.classList.contains('hidden')) {
    pop.style.visibility = 'hidden'; pop.classList.remove('hidden');
    const btn = document.getElementById('btn-vol-toggle');
    const rect = btn.getBoundingClientRect();
    const VW = window.innerWidth, popH = pop.offsetHeight, popW = pop.offsetWidth || 270;
    let left = rect.left; if (left + popW > VW - 5) left = VW - popW - 5; left = Math.max(5, left);
    const top = Math.max(5, rect.top - popH - 8);
    pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = 'visible';
  } else pop.classList.add('hidden');
}
function closeVolPopup() { document.getElementById('vol-popup').classList.add('hidden'); }

// ── COLUMN VISIBILITY MODAL ──
function openColumnModal() {
  const lc = document.getElementById('column-checkbox-list'); lc.innerHTML = '';
  const ch = progress.hidden_columns[currentMode] || [];
  allFields.slice(1).forEach(f => {
    const label = f.key, isSheet = f.type === 'sheet';
    const div = document.createElement('div'); div.className = 'column-item'; div.setAttribute('data-key', label);
    div.innerHTML = `<div class="reorder-btns"><button onclick="moveModalItem(this,-1)">↑</button><button onclick="moveModalItem(this,1)">↓</button></div><input type="checkbox" id="chk-${label}" value="${label}" ${ch.includes(label) ? 'checked' : ''}><label for="chk-${label}" style="flex:1;cursor:pointer">${label}${isSheet ? '<span class="sheet-badge">sheet</span>' : ''}</label>`;
    div.querySelector('label').addEventListener('click', e => { e.preventDefault(); div.querySelector('input').checked = !div.querySelector('input').checked; });
    lc.appendChild(div);
  });
  document.getElementById('column-modal-root').classList.remove('hidden');
}
function moveModalItem(btn, dir) {
  const item = btn.closest('.column-item'), list = item.parentElement;
  if (dir === -1 && item.previousElementSibling) list.insertBefore(item, item.previousElementSibling);
  else if (dir === 1 && item.nextElementSibling) list.insertBefore(item.nextElementSibling, item);
}
function closeColumnModal() { document.getElementById('column-modal-root').classList.add('hidden'); }
function applyColumnVisibility() {
  const items = document.querySelectorAll('#column-checkbox-list .column-item');
  progress.field_order = Array.from(items).map(i => i.getAttribute('data-key'));
  progress.hidden_columns[currentMode] = Array.from(document.querySelectorAll('#column-checkbox-list input:checked')).map(i => i.value);
  markProgressDirty();
  buildAllFields(); validateCurrentField(); closeColumnModal(); updateDisplay();
}
function validateCurrentField() {
  const h = progress.hidden_columns[currentMode] || [];
  const label = allFields[currentFieldIndex]?.key;
  if (label && h.includes(label)) {
    let found = false;
    for (let i = 1; i < allFields.length; i++) { if (!h.includes(allFields[i].key)) { currentFieldIndex = i; found = true; break; } }
    if (!found) currentFieldIndex = 1;
  }
}

function toggleFurigana() {
  isFuriganaEnabled = !isFuriganaEnabled;
  progress.furigana = isFuriganaEnabled;
  markProgressDirty();
  updateFuriganaBtn(); updateDisplay();
}
function updateFuriganaBtn() {
  const btn = document.getElementById('furiganaToggle'); if (!btn) return;
  btn.innerText = isFuriganaEnabled ? 'Furigana: ON' : 'Furigana: OFF';
  btn.style.background = isFuriganaEnabled ? 'var(--primary)' : '#e2e8f0';
  btn.style.color = isFuriganaEnabled ? 'white' : '#475569';
}
function toggleDataMenu() {
  const w = document.getElementById('data-controls-wrapper'), btn = document.getElementById('btn-data-toggle');
  if (w.classList.contains('hidden')) { w.classList.remove('hidden'); btn.innerText = 'Data ▴'; btn.style.background = 'var(--primary)'; setTimeout(() => w.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100); }
  else { w.classList.add('hidden'); btn.innerText = 'Data ▾'; btn.style.background = '#334155'; }
}

// ── MAIN DISPLAY ──
function updateDisplay(shouldSpeak = false) {
  if (!vocab.rows.length || !allFields.length) return;
  const word = currentMode === 'study' ? vocab.rows[currentWordIndex] : reviewPool[reviewIndex];
  if (!word) return;
  const total = currentMode === 'study' ? vocab.rows.length : reviewPool.length;
  const sttVal = word[vocab.headers[0]];
  document.getElementById('word-counter-top').innerText = `${sttVal} / ${total}`;
  const hidden = progress.hidden_columns[currentMode] || [];
  let prevLabel = '', nextLabel = '';
  for (let i = currentFieldIndex - 1; i >= 1; i--) { if (!hidden.includes(allFields[i].key)) { prevLabel = allFields[i].key; break; } }
  for (let i = currentFieldIndex + 1; i < allFields.length; i++) { if (!hidden.includes(allFields[i].key)) { nextLabel = allFields[i].key; break; } }
  document.getElementById('prev-field').innerText = prevLabel;
  document.getElementById('curr-field').innerText = allFields[currentFieldIndex]?.key || '';
  document.getElementById('next-field').innerText = nextLabel;
  document.getElementById('btn-prev-field').style.visibility = prevLabel ? 'visible' : 'hidden';
  document.getElementById('btn-next-field').style.visibility = nextLabel ? 'visible' : 'hidden';
  const displayEl = document.getElementById('display-text');
  const hintEl = document.getElementById('speaker-hint');
  const fc = getFieldContent(word, currentFieldIndex);
  if (!fc.isSheet) {
    const txt = fc.content || '';
    displayEl.innerHTML = isFuriganaEnabled ? formatFurigana(txt).replace(/\n/g, '<br>') : escapeHtml(txt.replace(/\(.*?\)/g, '')).replace(/\n/g, '<br>');
    hintEl.innerText = 'Chạm để đọc';
  } else {
    const items = fc.items || [];
    const fullRows = vocab.sheets[fc.sheetName] || [];
    if (!items.length) {
      displayEl.innerHTML = '<span style="color:#94a3b8;font-size:1.1rem;font-weight:normal">— Không có dữ liệu —</span>';
    } else {
      displayEl.innerHTML = items.map(item => {
        const rowIdx = fullRows.indexOf(item);
        const viClean = cleanStr(item.vi || ''), jpClean = cleanStr(item.jp || '');
        const audioClean = cleanStr(item.audio || '').trim();
        const viAttr = escapeAttr(viClean);
        const jpHtml = renderJpHtmlSafe(jpClean);
        const jpRaw = escapeAttr(jpClean.replace(/\(.*?\)/g, '').trim());
        const audioAttr = escapeAttr(audioClean);
        const speakIcon = audioClean ? '🎧' : '🔊'; // 🎧 = có audio thu sẵn, 🔊 = giọng đọc trình duyệt
        return `<span class="jp-line" data-vi="${viAttr}" data-sheet="${escapeHtml(fc.sheetName)}" data-row-idx="${rowIdx}">
          <span class="jp-text">${jpHtml || '&nbsp;'}</span>
          <button class="jp-speak-btn" data-jp="${jpRaw}" data-audio="${audioAttr}" title="Phát âm dòng này">${speakIcon}</button>
          <span class="jp-vi-icon">💬</span>
        </span>`;
      }).join('');
    }
    hintEl.innerText = isEditing ? 'Sửa jp trực tiếp' : '🔊 = phát âm · 💬 = xem nghĩa';
  }
  const st = progress.stats[sttVal];
  document.getElementById('status-display-top').innerHTML = st === 'learned' ? '✅' : st === 'mastered' ? '⭐' : '<span style="opacity:.2">•</span>';
  if (shouldSpeak && !isAutoPlaying && document.getElementById('autoSpeak').checked) setTimeout(() => speakText(), 100);
  updateFuriganaBtn();
}

// ── NAVIGATION ──
function stopSpeech() { _speechSession++; synth.cancel(); if (_currentAudioEl) { try { _currentAudioEl.pause(); } catch (e) {} _currentAudioEl = null; } }
function clearFieldTimer() { if (fieldClickTimer !== null) { clearTimeout(fieldClickTimer); fieldClickTimer = null; } }
function moveWord(step) {
  clearFieldTimer(); stopSpeech();
  currentWordIndex = (currentWordIndex + step + vocab.rows.length) % vocab.rows.length;
  currentFieldIndex = 1; updateDisplay(true);
  progress.current_index = currentWordIndex;
  markProgressDirty();
}
function nextReviewWord() { clearFieldTimer(); stopSpeech(); if (reviewIndex < reviewPool.length - 1) reviewIndex++; else { prepareReviewPool(); reviewIndex = 0; } currentFieldIndex = 1; updateDisplay(true); }
function prevReviewWord() { clearFieldTimer(); stopSpeech(); reviewIndex = (reviewIndex - 1 + reviewPool.length) % reviewPool.length; currentFieldIndex = 1; updateDisplay(true); }
function handleNext() { if (currentMode === 'study') moveWord(1); else nextReviewWord(); }
function handlePrev() { if (currentMode === 'study') moveWord(-1); else prevReviewWord(); }
function changeField(dir) {
  clearFieldTimer(); stopSpeech();
  const h = progress.hidden_columns[currentMode] || []; let next = currentFieldIndex;
  while (true) { next += dir; if (next < 1 || next >= allFields.length) return false; if (!h.includes(allFields[next].key)) { currentFieldIndex = next; updateDisplay(true); return true; } }
}
function setStatus(status) {
  const word = currentMode === 'study' ? vocab.rows[currentWordIndex] : reviewPool[reviewIndex];
  if (!word) return;
  const key = word[vocab.headers[0]];
  const el = document.getElementById('curr-field');
  if (el) {
    el.style.transition = 'none'; el.style.color = status === 'learned' ? '#22c55e' : status === 'mastered' ? '#eab308' : '#ef4444'; el.style.transform = 'scale(1.1)';
    setTimeout(() => { el.style.transition = 'all .3s ease'; el.style.color = ''; el.style.transform = 'scale(1)'; }, 200);
  }
  if (status === null) delete progress.stats[key]; else progress.stats[key] = status;
  markProgressDirty();
  if (currentMode === 'review' && (status === 'mastered' || status === null)) {
    reviewPool.splice(reviewIndex, 1);
    if (!reviewPool.length) { stopAutoPlay(); alert('Hoàn thành ôn tập!'); switchMode('study'); return; }
    if (reviewIndex >= reviewPool.length) reviewIndex = 0;
    updateDisplay();
  } else { updateDisplay(); if (currentMode === 'review') nextReviewWord(); }
}

// ── MODE ──
function toggleModeMenu(e) { if (e) e.stopPropagation(); const dd = document.getElementById('mode-dropdown'), ar = document.getElementById('menu-arrow'); const show = dd.classList.toggle('show'); if (ar) ar.style.transform = show ? 'rotate(180deg)' : 'rotate(0deg)'; }
function selectMode(mode, e) { if (e) e.stopPropagation(); document.getElementById('mode-dropdown').classList.remove('show'); const ar = document.getElementById('menu-arrow'); if (ar) ar.style.transform = 'rotate(0deg)'; if (mode === 'study' || mode === 'review') { if (currentMode !== mode) switchMode(mode); } else showQuizScreen(); }
function switchMode(mode) {
  stopSpeech(); stopAutoPlay(); currentMode = mode;
  const t = document.getElementById('mode-title');
  if (mode === 'review') {
    prepareReviewPool();
    if (!reviewPool.length) { alert('Trống!'); currentMode = 'study'; return; }
    t.innerHTML = 'Chế độ ôn tập <span id="menu-arrow">▾</span>';
    document.getElementById('review-controls').classList.remove('hidden');
    document.getElementById('random-multi-wrap').classList.remove('hidden');
    reviewIndex = 0; currentFieldIndex = 1; updateDisplay(true);
  } else {
    t.innerHTML = 'Chế độ học tập <span id="menu-arrow">▾</span>';
    document.getElementById('review-controls').classList.add('hidden');
    document.getElementById('random-multi-wrap').classList.add('hidden');
    currentFieldIndex = 1; updateDisplay(true);
  }
  document.getElementById('mode-dropdown').style.display = 'none';
}
function prepareReviewPool() {
  const learned = vocab.rows.filter(w => progress.stats[w[vocab.headers[0]]] === 'learned');
  const mastered = vocab.rows.filter(w => progress.stats[w[vocab.headers[0]]] === 'mastered');
  if (document.getElementById('randomMulti').checked) {
    const lim = Math.max(1, Math.floor(learned.length * .05));
    reviewPool = [...learned, ...[...mastered].sort(() => Math.random() - .5).slice(0, lim)].sort(() => Math.random() - .5);
  } else {
    const seen = new Set(); const pool = [];
    [...learned, ...mastered].sort(() => Math.random() - .5).forEach(w => {
      const stt = String(w[vocab.headers[0]]); if (seen.has(stt)) return;
      const m = stt.match(/^(\d+)([a-z])$/);
      if (m) { vocab.rows.filter(x => String(x[vocab.headers[0]]).startsWith(m[1]) && /^\d+[a-z]$/.test(String(x[vocab.headers[0]]))).sort((a, b) => String(a[vocab.headers[0]]).localeCompare(String(b[vocab.headers[0]]))).forEach(x => { pool.push(x); seen.add(String(x[vocab.headers[0]])); }); }
      else { pool.push(w); seen.add(stt); }
    });
    reviewPool = pool;
  }
}
