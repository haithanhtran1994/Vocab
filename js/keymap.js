// ============================================================
// keymap.js — gán phím tắt tuỳ chỉnh cho các chức năng của app.
// CHỈ hoạt động trên Windows. Trên máy khác (iPhone/Safari/macOS...) file này
// không làm gì cả, app dùng phím tắt mặc định cũ trong main.js như trước.
//
// Cấu hình được lưu vào mapping.json ở GỐC repo private (cùng repo với data),
// nên đổi sang máy Windows khác chỉ cần kết nối GitHub là có lại đúng mapping cũ.
// ============================================================

const KEYMAP_PATH = 'mapping.json';
const IS_WINDOWS = /Win/i.test(navigator.platform || '') || /Windows/i.test(navigator.userAgent || '');
window.KEYMAP_ACTIVE = IS_WINDOWS; // main.js nhìn cờ này để nhường quyền xử lý phím

// Danh sách chức năng có thể gán phím. def = phím mặc định ('' = chưa gán).
const KEY_ACTIONS = [
  { id: 'next_word',       label: 'Từ kế tiếp',                         def: 'arrowright', run: () => handleNext() },
  { id: 'prev_word',       label: 'Từ trước đó',                        def: 'arrowleft',  run: () => handlePrev() },
  { id: 'next_field',      label: 'Trường kế tiếp',                     def: 'arrowdown',  run: () => changeField(1) },
  { id: 'prev_field',      label: 'Trường trước đó',                    def: 'arrowup',    run: () => changeField(-1) },
  { id: 'next_field_wrap', label: 'Trường kế tiếp (hết thì quay về đầu)', def: '',         run: () => nextFieldWrap() },
  { id: 'speak',           label: 'Phát âm (đọc thẻ)',                  def: 'r',          run: () => speakText() },
  { id: 'learned',         label: 'Đánh dấu đã học ✅',                  def: '1',          run: () => setStatus('learned') },
  { id: 'mastered',        label: 'Đánh dấu đã thuộc ⭐',                def: '2',          run: () => setStatus('mastered') },
  { id: 'forgot',          label: 'Xóa đánh dấu',                       def: '3',          run: () => setStatus(null) },
  { id: 'mode_study',      label: 'Chế độ Học tập',                     def: '',           run: () => selectMode('study') },
  { id: 'mode_review',     label: 'Chế độ Ôn tập',                      def: '',           run: () => selectMode('review') },
  { id: 'mode_quiz',       label: 'Chế độ Trắc nghiệm',                 def: '',           run: () => showQuizScreen() },
  { id: 'autoplay',        label: 'Tự động phát (Ôn tập)',              def: '',           run: () => { if (currentMode === 'review') toggleAutoPlay(); } },
  { id: 'toggle_furigana', label: 'Bật/tắt Furigana',                   def: '',           run: () => toggleFurigana() },
  { id: 'toggle_autospeak',label: 'Bật/tắt Tự động đọc',                def: '',           run: () => document.getElementById('autoSpeak').click() },
  { id: 'toggle_random',   label: 'Bật/tắt Random (Ôn tập)',            def: '',           run: () => { if (currentMode === 'review') document.getElementById('randomMulti').click(); } },
  { id: 'speed_up',        label: 'Tăng tốc độ đọc',                    def: '',           run: () => changeSpeed(0.25) },
  { id: 'speed_down',      label: 'Giảm tốc độ đọc',                    def: '',           run: () => changeSpeed(-0.25) },
  { id: 'volume',          label: 'Mở bảng âm lượng',                   def: '',           run: () => toggleVolPopup() },
  { id: 'columns',         label: 'Mở bảng ẩn/hiện cột',                def: '',           run: () => openColumnModal() },
  { id: 'data_menu',       label: 'Mở/đóng menu Data',                  def: '',           run: () => toggleDataMenu() },
  { id: 'folders',         label: 'Mở bảng chọn bộ từ vựng 📁',          def: '',           run: () => openFolderModal() },
  { id: 'settings',        label: 'Mở cài đặt GitHub ⚙️',               def: '',           run: () => openSettings() }
];
const KEY_REPEATABLE = ['next_word', 'prev_word', 'next_field', 'prev_field'];

let keymapBindings = {};   // action id -> combo string ('' = chưa gán)
let keymapReverse = {};    // combo -> action id
let keymapSha = null;
let _keymapLoaded = false;
let keymapDraft = {};

function changeSpeed(delta) {
  const el = document.getElementById('voiceRate'); if (!el) return;
  let v = Math.min(3, Math.max(0.25, (parseFloat(el.value) || 1) + delta));
  el.value = v;
  document.getElementById('speed-display').innerText = v + 'x';
}

// ── Chuẩn hoá tổ hợp phím: "ctrl+shift+k", "arrowright", "1"... ──
function comboFromEvent(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null; // mới chỉ bấm phím bổ trợ
  let base;
  if (/^Key[A-Z]$/.test(e.code)) base = e.code.slice(3).toLowerCase();
  else if (/^Digit[0-9]$/.test(e.code)) base = e.code.slice(5);
  else base = e.key === ' ' ? 'space' : e.key.toLowerCase();
  const mods = [];
  if (e.ctrlKey) mods.push('ctrl');
  if (e.altKey) mods.push('alt');
  if (e.shiftKey) mods.push('shift');
  if (e.metaKey) mods.push('meta');
  return [...mods, base].join('+');
}
function prettyCombo(c) {
  if (!c) return '';
  const arrows = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', space: 'Space' };
  return c.split('+').map(p => arrows[p] || (p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))).join('+');
}

function applyBindings(saved) {
  keymapBindings = {};
  KEY_ACTIONS.forEach(a => {
    keymapBindings[a.id] = (saved && Object.prototype.hasOwnProperty.call(saved, a.id)) ? (saved[a.id] || '') : a.def;
  });
  keymapReverse = {};
  KEY_ACTIONS.forEach(a => { const c = keymapBindings[a.id]; if (c && !keymapReverse[c]) keymapReverse[c] = a.id; });
}

// ── Tải / lưu mapping.json ──
async function loadKeymap(force) {
  if (!IS_WINDOWS) return;
  if (_keymapLoaded && !force) return;
  _keymapLoaded = true;
  try {
    const r = await ghGetFile(KEYMAP_PATH);
    keymapSha = r.sha;
    if (r.content && r.content.bindings) {
      applyBindings(r.content.bindings);
      localStorage.setItem('vocab_keymap', JSON.stringify(r.content.bindings));
    }
  } catch (err) {
    console.warn('Không tải được mapping.json, dùng bản lưu trong máy/mặc định:', err.message);
  }
}
async function saveKeymapToGitHub(bindings) {
  const body = { version: 1, bindings };
  const msg = '⌨️ Cập nhật phím tắt';
  try {
    const res = await ghPutFile(KEYMAP_PATH, body, keymapSha, msg);
    keymapSha = res.content.sha;
  } catch (err) {
    if (err.status === 409 || err.status === 422) { // sha cũ / file đã tồn tại -> lấy sha mới rồi thử lại 1 lần
      const fresh = await ghGetFile(KEYMAP_PATH);
      const res = await ghPutFile(KEYMAP_PATH, body, fresh.sha, msg);
      keymapSha = res.content.sha;
    } else throw err;
  }
}

// ── Bộ xử lý phím (chỉ chạy khi IS_WINDOWS) ──
function isTypingTarget(t) {
  if (!t) return false;
  if (t.isContentEditable || t.contentEditable === 'true') return true;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  if (t.tagName === 'INPUT') return !['checkbox', 'radio', 'range', 'button', 'file'].includes((t.type || '').toLowerCase());
  return false;
}
function anyModalOpen() {
  return Array.from(document.querySelectorAll('.modal-overlay')).some(m => !m.classList.contains('hidden'))
    || !document.getElementById('audio-unlock').classList.contains('hidden');
}
function onKeymapKeydown(e) {
  if (!IS_WINDOWS) return;
  if (isTypingTarget(e.target) || anyModalOpen()) return;
  const combo = comboFromEvent(e);
  if (!combo) return;
  const id = keymapReverse[combo];
  if (!id) return;
  const studyVisible = !document.getElementById('study-screen').classList.contains('hidden');
  const quizVisible = !document.getElementById('quiz-screen').classList.contains('hidden');
  if (!studyVisible) {
    // đang ở màn Trắc nghiệm: cho phép phím chuyển chế độ để thoát ra
    if (quizVisible && (id === 'mode_study' || id === 'mode_review')) { e.preventDefault(); exitQuiz(true); }
    else return;
  }
  e.preventDefault();
  if (e.repeat && !KEY_REPEATABLE.includes(id)) return;
  const action = KEY_ACTIONS.find(a => a.id === id);
  if (action) action.run();
}
window.addEventListener('keydown', onKeymapKeydown);

// ── Bảng cài đặt phím tắt ──
function openKeymapModal() {
  keymapDraft = Object.assign({}, keymapBindings);
  const list = document.getElementById('keymap-list');
  list.innerHTML = '';
  KEY_ACTIONS.forEach(a => {
    const row = document.createElement('div');
    row.className = 'keymap-row';
    const lab = document.createElement('div'); lab.className = 'keymap-label'; lab.textContent = a.label;
    const wrap = document.createElement('div'); wrap.className = 'keymap-cell';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.readOnly = true; inp.className = 'keymap-input';
    inp.placeholder = 'Bấm để gán phím...'; inp.value = prettyCombo(keymapDraft[a.id]);
    inp.addEventListener('focus', () => { inp.placeholder = 'Bấm phím... (Esc = hủy)'; });
    inp.addEventListener('blur', () => { inp.placeholder = 'Bấm để gán phím...'; });
    inp.addEventListener('keydown', ev => {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.key === 'Escape') { inp.blur(); return; }
      const c = comboFromEvent(ev);
      if (!c) return;
      keymapDraft[a.id] = c;
      inp.value = prettyCombo(c);
      inp.blur();
    });
    const clr = document.createElement('button');
    clr.className = 'keymap-clear'; clr.textContent = '✕'; clr.title = 'Xóa phím đã gán';
    clr.onclick = () => { keymapDraft[a.id] = ''; inp.value = ''; };
    wrap.appendChild(inp); wrap.appendChild(clr);
    row.appendChild(lab); row.appendChild(wrap);
    list.appendChild(row);
  });
  document.getElementById('keymap-modal-root').classList.remove('hidden');
}
function closeKeymapModal() { document.getElementById('keymap-modal-root').classList.add('hidden'); }
function resetKeymapDraft() {
  if (!confirm('Đặt lại toàn bộ về phím mặc định?')) return;
  keymapDraft = {}; KEY_ACTIONS.forEach(a => { keymapDraft[a.id] = a.def; });
  document.querySelectorAll('#keymap-list .keymap-input').forEach((inp, i) => { inp.value = prettyCombo(keymapDraft[KEY_ACTIONS[i].id]); });
}
async function confirmKeymap() {
  // kiểm tra trùng phím giữa các chức năng
  const seen = {}, dups = [];
  KEY_ACTIONS.forEach(a => {
    const c = keymapDraft[a.id]; if (!c) return;
    if (seen[c]) dups.push(`${prettyCombo(c)}: "${seen[c]}" và "${a.label}"`); else seen[c] = a.label;
  });
  if (dups.length) { alert('Có phím bị gán trùng, hãy sửa lại:\n\n' + dups.join('\n')); return; }
  applyBindings(keymapDraft);
  localStorage.setItem('vocab_keymap', JSON.stringify(keymapBindings));
  closeKeymapModal();
  setSyncStatus('saving');
  try { await saveKeymapToGitHub(keymapBindings); setSyncStatus('saved'); }
  catch (err) { setSyncStatus('error', err.message); alert('Đã áp dụng phím tắt trên máy này nhưng lưu lên GitHub bị lỗi: ' + err.message); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!IS_WINDOWS) return;
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem('vocab_keymap')); } catch (e) {}
  applyBindings(cached);                                   // dùng bản lưu trong máy ngay, chưa cần chờ mạng
  const btn = document.getElementById('btn-keymap');
  if (btn) btn.classList.remove('hidden');                  // nút chỉ hiện trên Windows
});
