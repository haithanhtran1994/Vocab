// ============================================================
// speech.js — đọc từ vựng bằng Web Speech API
// ============================================================

const synth = window.speechSynthesis;
let isAutoPlaying = false, availableVoices = [];
let _speechSession = 0;

function loadVoices() { availableVoices = synth.getVoices(); }
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

function unlockAudio() {
  synth.speak(new SpeechSynthesisUtterance(''));
  document.getElementById('audio-unlock').classList.add('hidden');
}

function speakText(callback) { const session = ++_speechSession; _doSpeakText(callback, session); }
function _doSpeakText(callback, session) {
  if (_speechSession !== session) { if (callback) callback(); return; }
  const word = currentMode === 'study' ? vocab.rows[currentWordIndex] : reviewPool[reviewIndex];
  if (!word) { if (callback) callback(); return; }
  const fc = getFieldContent(word, currentFieldIndex);
  if (fc.isSheet) {
    const items = (fc.items || []).filter(it => (it.jp || '').trim() && it.jp !== 'N.A');
    if (!items.length) { if (callback) callback(); return; }
    let i = 0;
    const nextItem = () => {
      if (_speechSession !== session) { if (callback) callback(); return; }
      if (i >= items.length) { if (callback) callback(); return; }
      const item = items[i++];
      const jpText = cleanStr(item.jp || '').replace(/\(.*?\)/g, '').trim();
      const viText = cleanStr(item.vi || '').trim();
      _speakSingle(jpText, session, () => {
        if (_speechSession !== session) return;
        if (!viText || viText === 'N.A') { setTimeout(nextItem, 200); return; }
        setTimeout(() => _speakSingle(viText, session, () => setTimeout(nextItem, 200)), 200);
      });
    };
    nextItem(); return;
  }
  const displayEl = document.getElementById('display-text'); if (!displayEl) { if (callback) callback(); return; }
  const tmp = displayEl.cloneNode(true); tmp.querySelectorAll('rt').forEach(r => r.remove());
  let text = tmp.innerText.replace(/\(.*?\)/g, '').trim();
  if (!text || text === 'N.A' || text === '---') { if (callback) callback(); return; }
  _speakSingle(text, session, callback);
}
function speakSingle(text, callback) { const session = ++_speechSession; _speakSingle(text, session, callback); }
function _speakSingle(text, session, callback) {
  if (_speechSession !== session) return;
  const isVN = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệđìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(text);
  const isJP = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
  const lang = isVN ? 'vi-VN' : isJP ? 'ja-JP' : 'en-US';
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.volume = getVolForLang(lang);
  const voices = synth.getVoices(); let voice = null;
  if (lang === 'vi-VN') voice = voices.find(v => v.lang.startsWith('vi') && v.name.includes('Linh') && v.name.includes('Enhanced')) || voices.find(v => v.lang.startsWith('vi') && (v.name.includes('Linh') || v.name.includes('An'))) || voices.find(v => v.lang.startsWith('vi'));
  else if (lang === 'ja-JP') voice = voices.find(v => v.lang.startsWith('ja') && v.name.includes('Kyoko') && v.name.includes('Enhanced')) || voices.find(v => v.lang.startsWith('ja') && (v.name.includes('Kyoko') || v.name.includes('Haruka') || v.name.includes('Ichiro'))) || voices.find(v => v.lang.startsWith('ja'));
  else voice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Allison') || v.name.includes('Samantha')) && v.name.includes('Enhanced')) || voices.find(v => v.lang.startsWith('en') && (v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('David'))) || voices.find(v => v.lang.startsWith('en'));
  if (voice) utter.voice = voice;
  utter.rate = document.getElementById('voiceRate').value || 1;
  utter.onend = () => { if (_speechSession === session && callback) callback(); };
  utter.onerror = () => {};
  setTimeout(() => { if (_speechSession === session) synth.speak(utter); }, 100);
}

// ── AUTOPLAY (chế độ ôn tập) ──
function toggleAutoPlay() { if (isAutoPlaying) stopAutoPlay(); else startAutoPlay(); }
function startAutoPlay() {
  isAutoPlaying = true;
  document.getElementById('btn-autoplay').innerText = '⏹ Dừng phát';
  document.getElementById('btn-autoplay').style.background = 'var(--danger)';
  currentFieldIndex = 1; updateDisplay(); playSequence();
}
function stopAutoPlay() {
  isAutoPlaying = false; synth.cancel();
  const btn = document.getElementById('btn-autoplay');
  if (btn) { btn.innerText = '▶ Tự động phát'; btn.style.background = '#8b5cf6'; }
}
function playSequence() {
  if (!isAutoPlaying) return;
  const session = _speechSession;
  const uh = new SpeechSynthesisUtterance(allFields[currentFieldIndex]?.key || '');
  uh.lang = 'vi-VN'; uh.rate = document.getElementById('voiceRate').value;
  uh.volume = getVolForLang('vi-VN');
  if (availableVoices.length) { const v = availableVoices.find(v => v.lang.startsWith('vi-VN')); if (v) uh.voice = v; }
  uh.onend = () => {
    if (!isAutoPlaying || _speechSession !== session) return;
    speakText(() => {
      if (!isAutoPlaying) return;
      setTimeout(() => {
        if (!isAutoPlaying) return;
        if (currentFieldIndex < allFields.length - 1) { currentFieldIndex++; updateDisplay(); playSequence(); }
        else if (reviewIndex < reviewPool.length - 1) { reviewIndex++; currentFieldIndex = 1; updateDisplay(); playSequence(); }
        else stopAutoPlay();
      }, 800);
    });
  };
  uh.onerror = () => {};
  synth.speak(uh);
}
