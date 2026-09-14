// ============================================================
// quiz.js — trắc nghiệm dựa trên các từ đã đánh dấu học/thuộc
// (kịch bản trắc nghiệm lưu trong progress.json)
// ============================================================

let quizInterval, quizData = [], userAnswers = {};

function showQuizScreen(event) {
  if (event) event.stopPropagation();
  document.getElementById('mode-dropdown').classList.remove('show');
  const ar = document.getElementById('menu-arrow'); if (ar) ar.style.transform = 'rotate(0deg)';
  stopSpeech(); stopAutoPlay();
  document.getElementById('study-screen').classList.add('hidden');
  document.getElementById('quiz-screen').classList.remove('hidden');
  document.getElementById('quiz-setup').classList.remove('hidden');
  document.getElementById('quiz-playing').classList.add('hidden');
  document.getElementById('quiz-header-title').innerText = `📝 Trắc nghiệm (${vocab.rows.filter(w => progress.stats[w[vocab.headers[0]]]).length} từ đã học)`;
  if (!progress.quiz_scenarios.length) { progress.quiz_scenarios.push({ root: allFields[1]?.key || vocab.headers[1], exclude: [] }); markProgressDirty(); }
  renderScenarios();
}
function addScenario() { progress.quiz_scenarios.push({ root: allFields[1]?.key || vocab.headers[1], exclude: [] }); markProgressDirty(); renderScenarios(); }
function removeScenario(idx) { progress.quiz_scenarios.splice(idx, 1); if (!progress.quiz_scenarios.length) addScenario(); else { markProgressDirty(); renderScenarios(); } }
function renderScenarios() {
  const list = document.getElementById('scenarios-list'); list.innerHTML = '';
  const pool = vocab.rows.filter(w => progress.stats[w[vocab.headers[0]]] === 'learned' || progress.stats[w[vocab.headers[0]]] === 'mastered');
  const qf = allFields.slice(1);
  progress.quiz_scenarios.forEach((sc, idx) => {
    if (!qf.find(f => f.key === sc.root)) sc.root = qf[0]?.key || '';
    const box = document.createElement('div'); box.className = 'scenario-box';
    let est = 0;
    qf.filter(f => f.key !== sc.root && !sc.exclude.includes(f.key)).forEach(f => {
      if (f.type === 'vocab') est += pool.length;
      else pool.forEach(w => { est += (vocab.sheets[f.key] || []).filter(r => String(r.stt) === String(w[vocab.headers[0]]) && r.jp && r.vi).length; });
    });
    box.innerHTML = `<span class="remove-scenario" onclick="removeScenario(${idx})">✖ Xóa</span><span class="scenario-title">Kịch bản ${idx + 1}</span><div style="font-size:.8rem;color:var(--primary);margin-bottom:8px">Ước tính: <strong>${est}</strong> câu</div>
      <div class="select-group"><label>Cột gốc (đề):</label><select onchange="updateRoot(${idx},this.value)" style="width:100%;padding:5px;border-radius:5px">${qf.map(f => `<option value="${f.key}" ${f.key === sc.root ? 'selected' : ''}>${f.key}${f.type === 'sheet' ? ' 📋' : ''}</option>`).join('')}</select></div>
      <div class="select-group"><label>Cột loại trừ:</label><div class="exclude-list">${qf.filter(f => f.key !== sc.root).map(f => `<label class="exclude-item"><input type="checkbox" ${sc.exclude.includes(f.key) ? 'checked' : ''} onchange="toggleExclude(${idx},'${f.key}')">${f.key}${f.type === 'sheet' ? ' 📋' : ''}</label>`).join('')}</div></div>`;
    list.appendChild(box);
  });
}
function updateRoot(idx, val) { progress.quiz_scenarios[idx].root = val; markProgressDirty(); renderScenarios(); }
function toggleExclude(idx, val) { const arr = progress.quiz_scenarios[idx].exclude; const i = arr.indexOf(val); if (i > -1) arr.splice(i, 1); else arr.push(val); markProgressDirty(); renderScenarios(); }

function startQuiz() {
  const Q = parseInt(document.getElementById('quizCount').value) || null;
  const timeVal = parseInt(document.getElementById('timePerQuestion').value) || 10;
  const pool = vocab.rows.filter(w => progress.stats[w[vocab.headers[0]]]);
  if (!pool.length) { alert('Học thêm từ đi!'); return; }
  quizData = []; userAnswers = {};
  const qf = allFields.slice(1);
  progress.quiz_scenarios.forEach(sc => {
    const targets = qf.filter(f => f.key !== sc.root && !sc.exclude.includes(f.key));
    pool.forEach(word => {
      targets.forEach(tf => {
        if (tf.type === 'vocab') {
          const cV = cleanStr(word[tf.key] || ''); if (cV && cV !== 'N.A') quizData.push({ rH: sc.root, tH: tf.key, rV: cleanStr(word[sc.root] || ''), cV, isSheetQ: false });
        } else {
          const stt = String(word[vocab.headers[0]]);
          (vocab.sheets[tf.key] || []).filter(r => String(r.stt) === stt && r.jp && r.vi).forEach(item => { quizData.push({ rH: sc.root, tH: tf.key, rV: cleanStr(word[sc.root] || ''), cV: cleanStr(item.vi), jpHint: cleanStr(item.jp), isSheetQ: true }); });
        }
      });
    });
  });
  quizData.sort(() => Math.random() - .5); if (Q && Q < quizData.length) quizData = quizData.slice(0, Q);
  document.getElementById('quiz-setup').classList.add('hidden'); document.getElementById('quiz-playing').classList.remove('hidden');
  document.getElementById('quiz-result-summary').classList.add('hidden'); document.getElementById('quiz-finish-btn').classList.remove('hidden');
  const container = document.getElementById('quiz-container'); container.innerHTML = '';
  quizData.forEach((q, idx) => {
    const item = document.createElement('div'); item.className = 'quiz-item'; item.id = `quiz-q-${idx}`;
    let allVals, choices;
    if (q.isSheetQ) {
      allVals = [...new Set((vocab.sheets[q.tH] || []).map(r => cleanStr(r.vi)))].filter(Boolean);
      choices = [q.cV, ...allVals.filter(v => v !== q.cV).sort(() => Math.random() - .5).slice(0, 3)].sort(() => Math.random() - .5);
      item.innerHTML = `<div class="jp-hint-box">${escapeHtml(q.jpHint)}</div><h4 style="cursor:pointer;color:var(--primary);font-size:.95rem" onclick="document.getElementById('quiz-result-summary').scrollIntoView({behavior:'smooth'})">Câu ${idx + 1}: Nghĩa của câu trên (${escapeHtml(q.tH)} · ${escapeHtml(q.rV)})?</h4>`;
    } else {
      allVals = [...new Set(vocab.rows.map(w => cleanStr(w[q.tH] || '')))].filter(Boolean);
      choices = [q.cV, ...allVals.filter(v => v !== q.cV).sort(() => Math.random() - .5).slice(0, 3)].sort(() => Math.random() - .5);
      item.innerHTML = `<h4 style="cursor:pointer;color:var(--primary)" onclick="document.getElementById('quiz-result-summary').scrollIntoView({behavior:'smooth'})">Câu ${idx + 1}: "${escapeHtml(q.tH)}" của <u>${escapeHtml(q.rV)}</u>?</h4>`;
    }
    choices.forEach(c => { const b = document.createElement('button'); b.className = 'option-btn'; b.innerText = c; b.onclick = () => { if (document.getElementById('quiz-finish-btn').classList.contains('hidden')) return; Array.from(item.querySelectorAll('.option-btn')).forEach(x => x.classList.remove('selected')); b.classList.add('selected'); userAnswers[idx] = c; }; item.appendChild(b); });
    container.appendChild(item);
  });
  let timeLeft = quizData.length * timeVal; clearInterval(quizInterval);
  quizInterval = setInterval(() => { timeLeft--; const m = Math.floor(timeLeft / 60), s = timeLeft % 60; document.getElementById('time-left').innerText = `${m}:${s < 10 ? '0' : ''}${s}`; if (timeLeft <= 0) { clearInterval(quizInterval); finishQuiz(); } }, 1000);
}
function restartQuiz() { clearInterval(quizInterval); document.getElementById('quiz-result-summary').classList.add('hidden'); document.getElementById('quiz-finish-btn').classList.remove('hidden'); startQuiz(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function finishQuiz() {
  clearInterval(quizInterval); document.getElementById('quiz-finish-btn').classList.add('hidden');
  const summary = document.getElementById('quiz-result-summary'); summary.classList.remove('hidden'); let score = 0;
  quizData.forEach((q, idx) => { const item = document.getElementById(`quiz-q-${idx}`); item.querySelectorAll('.option-btn').forEach(b => { b.style.pointerEvents = 'none'; if (b.innerText === q.cV) b.classList.add('correct-ans'); if (userAnswers[idx] === b.innerText && b.innerText !== q.cV) b.classList.add('wrong-ans'); }); if (userAnswers[idx] === q.cV) score++; });
  summary.innerHTML = `<h3 style="margin-top:0">Kết quả: ${score}/${quizData.length}</h3><div style="display:flex;gap:10px;margin-bottom:15px"><button onclick="restartQuiz()" style="flex:1;padding:12px;background:var(--primary);color:white;border:none;border-radius:8px;font-weight:bold">🔄 Làm lại</button><button onclick="exitQuiz(true)" style="flex:1;padding:12px;background:#64748b;color:white;border:none;border-radius:8px;font-weight:bold">🏠 Thoát</button></div>`;
  quizData.forEach((_, i) => { const d = document.createElement('span'); d.className = 'dot-nav'; d.style.background = userAnswers[i] === quizData[i].cV ? 'var(--success)' : 'var(--danger)'; d.innerText = i + 1; d.onclick = () => document.getElementById(`quiz-q-${i}`).scrollIntoView({ behavior: 'smooth' }); summary.appendChild(d); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function exitQuiz(forceQuit = false) {
  clearInterval(quizInterval);
  const setup = document.getElementById('quiz-setup'), playing = document.getElementById('quiz-playing'), result = document.getElementById('quiz-result-summary');
  if (forceQuit) { document.getElementById('quiz-screen').classList.add('hidden'); document.getElementById('study-screen').classList.remove('hidden'); playing.classList.add('hidden'); result.classList.add('hidden'); setup.classList.remove('hidden'); return; }
  if (!result.classList.contains('hidden') || !playing.classList.contains('hidden')) { playing.classList.add('hidden'); result.classList.add('hidden'); setup.classList.remove('hidden'); const fb = document.getElementById('quiz-finish-btn'); if (fb) fb.classList.remove('hidden'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else { document.getElementById('quiz-screen').classList.add('hidden'); document.getElementById('study-screen').classList.remove('hidden'); }
}
