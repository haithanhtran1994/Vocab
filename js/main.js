// ============================================================
// main.js — khởi động app: màn hình kết nối GitHub, load dữ liệu,
// gắn các sự kiện toàn cục (bàn phím, vuốt, click ngoài modal...)
// ============================================================

let hotkeys = { next: 'arrowright', prev: 'arrowleft', learned: '1', mastered: '2', forgot: '3', speak: 'r', fieldNext: 'arrowdown', fieldPrev: 'arrowup' };

function initAppUI() {
  document.getElementById('connect-screen').classList.add('hidden');
  document.getElementById('study-screen').classList.remove('hidden');
  loadVolumes();
  isFuriganaEnabled = !!progress.furigana;
  updateFuriganaBtn();
  updateDisplay();
  document.getElementById('audio-unlock').classList.remove('hidden');
}

async function connectAndLoad() {
  const owner = document.getElementById('inp-gh-owner').value.trim();
  const repo = document.getElementById('inp-gh-repo').value.trim();
  const branch = document.getElementById('inp-gh-branch').value.trim() || 'main';
  const token = document.getElementById('inp-gh-token').value.trim();
  if (!owner || !repo) { alert('Nhập đầy đủ Owner và Repo.'); return; }
  if (!token && !ghHasToken()) { alert('Cần Personal Access Token để có thể LƯU dữ liệu lên GitHub (chỉ đọc thì có thể để trống nhưng khuyến khích luôn nhập).'); }
  ghSetConnection({ owner, repo, branch, token });
  const btn = document.getElementById('btn-connect'); btn.disabled = true; btn.innerText = 'Đang tải...';
  try {
    await loadAllFromGitHub();
    initAppUI();
  } catch (err) {
    alert('Lỗi kết nối GitHub: ' + err.message);
  } finally { btn.disabled = false; btn.innerText = 'Kết nối & Tải dữ liệu'; }
}

function openSettings() {
  document.getElementById('inp-gh-owner').value = localStorage.getItem('gh_owner') || CONFIG.github.owner;
  document.getElementById('inp-gh-repo').value = localStorage.getItem('gh_repo') || CONFIG.github.repo;
  document.getElementById('inp-gh-branch').value = localStorage.getItem('gh_branch') || CONFIG.github.branch;
  document.getElementById('inp-gh-token').value = '';
  document.getElementById('study-screen').classList.add('hidden');
  document.getElementById('connect-screen').classList.remove('hidden');
}

function tryAutoConnect() {
  document.getElementById('inp-gh-owner').value = localStorage.getItem('gh_owner') || CONFIG.github.owner;
  document.getElementById('inp-gh-repo').value = localStorage.getItem('gh_repo') || CONFIG.github.repo;
  document.getElementById('inp-gh-branch').value = localStorage.getItem('gh_branch') || CONFIG.github.branch;
  if (ghIsConfigured()) {
    connectAndLoad();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  tryAutoConnect();

  document.getElementById('screentip').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!screentipEditing) enterScreentipEdit();
  });
  document.getElementById('display-text').addEventListener('click', function (e) {
    if (isEditing) return;
    const speakBtn = e.target.closest('.jp-speak-btn');
    if (speakBtn) {
      e.stopPropagation();
      const jpLine = speakBtn.closest('.jp-line');
      const jpText = (speakBtn.getAttribute('data-jp') || '').trim();
      const audioPath = (speakBtn.getAttribute('data-audio') || '').trim();
      const viRaw = jpLine?.getAttribute('data-vi') || '';
      if (jpText || audioPath) {
        const mySession = ++_speechSession;
        _speakJapanesePart(jpText, audioPath, mySession, () => { if (viRaw && viRaw !== 'N.A') setTimeout(() => _speakSingle(viRaw, mySession, null), 200); });
      }
      return;
    }
    const jpLine = e.target.closest('.jp-line');
    if (jpLine) { const vi = jpLine.getAttribute('data-vi') || ''; if (vi) showScreentip(jpLine, vi); return; }
    const fc = getFieldContent(currentMode === 'study' ? vocab.rows[currentWordIndex] : reviewPool[reviewIndex], currentFieldIndex);
    if (!fc.isSheet) speakText();
  });

  const curField = document.getElementById('curr-field');
  if (curField) curField.onclick = function (e) {
    e.stopPropagation();
    if (fieldClickTimer === null) { fieldClickTimer = setTimeout(() => { fieldClickTimer = null; setStatus('learned'); }, 300); }
    else { clearTimeout(fieldClickTimer); fieldClickTimer = null; setStatus('mastered'); }
  };
});

window.onclick = function (e) {
  if (!e.target.closest('.mode-menu-container')) document.getElementById('mode-dropdown').classList.remove('show');
  if (!e.target.closest('#screentip') && !e.target.closest('#screentip-btns') && !e.target.closest('.jp-line')) { if (!screentipEditing) hideScreentip(); }
  if (!e.target.closest('#vol-popup') && !e.target.closest('#btn-vol-toggle')) document.getElementById('vol-popup').classList.add('hidden');
};

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.contentEditable === 'true') return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (k === hotkeys.next) handleNext();
  else if (k === hotkeys.prev) handlePrev();
  else if (k === hotkeys.learned) setStatus('learned');
  else if (k === hotkeys.mastered) setStatus('mastered');
  else if (k === hotkeys.forgot) setStatus(null);
  else if (k === hotkeys.speak) speakText();
  else if (k === hotkeys.fieldNext) changeField(1);
  else if (k === hotkeys.fieldPrev) changeField(-1);
});

// ── SWIPE ──
function disableSwipe() { if (cardElement) cardElement.style.touchAction = 'none'; }
function enableSwipe() { if (cardElement) cardElement.style.touchAction = ''; }
let touchstartX = 0, touchstartY = 0;
const cardElement = document.querySelector('.card');
const scrollArea = document.querySelector('.card-content');
if (cardElement) {
  cardElement.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; touchstartY = e.changedTouches[0].screenY; }, { passive: true });
  cardElement.addEventListener('touchmove', e => {
    if (isEditing) return;
    const dX = Math.abs(e.changedTouches[0].screenX - touchstartX), dY = Math.abs(e.changedTouches[0].screenY - touchstartY);
    if (dX > dY && dX > 10) { if (e.cancelable) e.preventDefault(); }
    else if (dY > dX) { const sc = scrollArea.scrollHeight > scrollArea.clientHeight; if (sc) e.stopPropagation(); else if (e.cancelable) e.preventDefault(); }
  }, { passive: false });
  cardElement.addEventListener('touchend', e => {
    const dX = e.changedTouches[0].screenX - touchstartX, dY = e.changedTouches[0].screenY - touchstartY;
    if (Math.abs(dX) > 40 && Math.abs(dX) > Math.abs(dY)) { if (dX < 0) handleNext(); else handlePrev(); }
  }, { passive: true });
}
