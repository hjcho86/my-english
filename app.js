/* My English - 개인용 영어 학습 앱 (서버 없이 동작, 진행 상황은 이 기기의 localStorage에 저장) */
const $ = (s, e = document) => e.querySelector(s);
const app = $('#app');
const KEY = 'my-english-v1';

/* content/*.js 가 등록한 유닛 묶음을 UNITS 뒤에 이어 붙임 (레벨, 시작 번호 순) */
(window.UNIT_PARTS || []).slice().sort((a, b) => a.lv - b.lv || a.start - b.start)
  .forEach(p => UNITS[p.lv].push(...p.units));
const CH = 10; // 챕터당 유닛 수

/* content/exp/*.js 의 문법 해설을 각 문제(g[3])와 레벨 테스트(r[4])에 붙임 */
(window.EXP_PARTS || []).forEach(p => p.exp.forEach((arr, i) => {
  const u = UNITS[p.lv][p.start - 1 + i];
  if (u) arr.forEach((t, j) => { if (u.g[j]) u.g[j][3] = t; });
}));
(window.TR_PARTS || []).forEach(p => p.tr.forEach((arr, i) => {
  const u = UNITS[p.lv][p.start - 1 + i];
  if (u) arr.forEach((t, j) => { if (u.g[j]) u.g[j][4] = t; });
}));
if (window.BASE_TR) {
  Object.keys(BASE_TR.units).forEach(lv => BASE_TR.units[lv].forEach((arr, i) => arr.forEach((t, j) => { const g = UNITS[lv][i] && UNITS[lv][i].g[j]; if (g) g[4] = t; })));
  PLACEMENT.forEach((r, i) => { r[5] = BASE_TR.placement[i]; });
}
if (window.BASE_EXP) {
  Object.keys(BASE_EXP.units).forEach(lv => BASE_EXP.units[lv].forEach((arr, i) => arr.forEach((t, j) => { const g = UNITS[lv][i] && UNITS[lv][i].g[j]; if (g) g[3] = t; })));
  PLACEMENT.forEach((r, i) => { r[4] = BASE_EXP.placement[i]; });
}

function fresh() { return { level: null, done: {}, xp: 0, streak: 0, last: null, wrong: [], vocab: {}, tests: [], hist: [], recent: [], settings: { why: true, preview: false, auto: true }, rev: 0 }; }
function load() { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY))); } catch { return fresh(); } }
function save(keep) { if (!keep) S.rev = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} }
const stateSig = window.stateSig;
let S = load();
const cfg = () => { // 같은 객체를 돌려줘야 cfg().why = ... 가 저장된다
  const d = { why: true, preview: false, auto: true };
  if (!S.settings || typeof S.settings !== 'object') S.settings = {};
  for (const k in d) if (!(k in S.settings)) S.settings[k] = d[k];
  return S.settings;
};
const applyWhy = () => document.body.classList.toggle('nowhy', !cfg().why);
applyWhy();

function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function norm(s) { return s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function today(d = new Date()) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function touchStreak() {
  const t = today(); if (S.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  S.streak = S.last === today(y) ? S.streak + 1 : 1; S.last = t;
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find(v => v.lang === 'en-US'); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function sayBtn(text, big) { const b = el('button', 'say' + (big ? ' big' : ''), '🔊'); b.onclick = () => speak(text); return b; }

/* ---------- 문제 생성 ---------- */
const mk = (o) => Object.assign({ k: o.type + '|' + o.prompt + '|' + (o.ans || o.a) }, o);

function distract(en, ko, pool, idx, n = 3) {
  // 같은 단어·같은 뜻은 보기에서 제외해 정답이 둘이 되는 일을 막는다
  const seen = new Set([idx ? ko : en]), out = [];
  for (const p of shuffle(pool)) {
    if (p[0] === en || p[1] === ko || seen.has(p[idx])) continue;
    seen.add(p[idx]); out.push(p[idx]); if (out.length === n) break;
  }
  return out;
}
// 어휘 해설: 뜻 + 같은 레벨 예문 하나
function vocabWhy(lv, en, ko) {
  let line = `'${en}' = ${ko}`;
  const re = new RegExp('\\b' + en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
  for (const u of UNITS[lv] || []) { const s = u.s.find(x => re.test(x[0])); if (s) { line += `\n예문: ${s[0]} (${s[1]})`; break; } }
  return line;
}
function mcqEnKo([en, ko], pool, lv) {
  const opts = [ko, ...distract(en, ko, pool, 1)];
  return mk({ type: 'mcq', title: '알맞은 뜻을 고르세요', prompt: en, say: en, opts, a: 0, vw: en, why: vocabWhy(lv, en, ko) });
}
function mcqKoEn([en, ko], pool, lv) {
  const opts = [en, ...distract(en, ko, pool, 0)];
  return mk({ type: 'mcq', title: '알맞은 영어를 고르세요', prompt: ko, opts, a: 0, vw: en, why: vocabWhy(lv, en, ko) });
}
function listenWord([en, ko]) { return mk({ type: 'type', title: '들리는 단어를 입력하세요', prompt: '🔊', say: en, ans: [en], hear: true, vw: en, why: `뜻: ${ko}` }); }
function orderSent([en, ko]) {
  const words = en.replace(/[.?!]$/, '').split(' ');
  return mk({ type: 'order', title: '영어로 배열하세요', prompt: ko, words, ans: en, why: `뜻: ${ko}` });
}
function listenSent([en, ko]) { return mk({ type: 'type', title: '들리는 문장을 입력하세요', prompt: '🔊', say: en, ans: [en], hear: true, why: `뜻: ${ko}` }); }
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function speakEx([en, ko]) { return mk({ type: 'speak', title: '소리 내어 읽어 보세요', prompt: en, say: en, ans: [en], why: `뜻: ${ko}` }); }
// 답을 낸 뒤 보여줄 내용: 완성된 문장 + 번역 + 해설
function gExtra([q, opts, a, why, tr]) {
  const lines = [];
  if (q.includes('___')) { lines.push(q.replace('___', opts[a])); if (tr) lines.push(tr); }
  if (why) lines.push('💡 ' + why);
  return lines.join('\n');
}
function grammar(g) { return mk({ type: 'mcq', title: '빈칸에 알맞은 말을 고르세요', prompt: g[0], opts: g[1], a: g[2], why: gExtra(g) }); }

function buildLesson(lv, ui) {
  const u = UNITS[lv][ui], pool = UNITS[lv].flatMap(x => x.v);
  const vs = shuffle(u.v), ss = shuffle(u.s), ex = [];
  vs.slice(0, 4).forEach(v => ex.push(mcqEnKo(v, pool, lv)));
  vs.slice(4, 8).forEach(v => ex.push(mcqKoEn(v, pool, lv)));
  shuffle(u.v).slice(0, 2).forEach(v => ex.push(listenWord(v)));
  ss.forEach(s => ex.push(orderSent(s)));
  ex.push(listenSent(ss[0]));
  if (SR) ex.push(speakEx(ss[1]));
  u.g.forEach(g => ex.push(grammar(g)));
  // 지난 유닛 단어 복습(간격 반복): 앞서 끝낸 유닛에서 최대 4개
  const prev = [];
  for (let i = 0; i < ui; i++) if (S.done[lv + '-' + i]) prev.push(...UNITS[lv][i].v);
  shuffle(prev).slice(0, 4).forEach((v, i) => ex.push(i % 2 ? mcqKoEn(v, pool, lv) : mcqEnKo(v, pool, lv)));
  return shuffle(ex);
}

/* ---------- 세션 공통 ---------- */
let keyHandler = null;
document.addEventListener('keydown', e => keyHandler && keyHandler(e));

function shell(onQuit) {
  app.innerHTML = '';
  const top = el('div', 'top'), x = el('button', 'x', '✕'), bar = el('div', 'bar'), fill = el('i');
  bar.append(fill); top.append(x, bar);
  const body = el('div', 'body'); body.id = 'body';
  const foot = el('div', 'foot'); foot.id = 'foot';
  app.append(top, body, foot);
  const wb = el('button', 'x whybtn', '💡'); wb.title = '정답 후 번역·해설 켜기/끄기';
  const paint = () => { wb.style.opacity = cfg().why ? 1 : .3; };
  wb.onclick = () => { cfg().why = !cfg().why; save(); applyWhy(); paint(); wb.classList.add('pop'); setTimeout(() => wb.classList.remove('pop'), 300); };
  paint(); top.append(wb);
  x.onclick = () => { if (confirm('그만둘까요? 이번 진행은 저장되지 않아요.')) { keyHandler = null; onQuit(); } };
  return p => { fill.style.width = Math.round(p * 100) + '%'; };
}

function mcqDetail(ex, sel) {
  let d = '';
  if (sel && sel.t) d += `내 답: ${sel.t}\n`;
  d += `정답: ${ex.opts[ex.a]}`;
  return d;
}

/* 문제 하나를 보여주고, 사용자가 '계속'을 누르면 done(정답여부) 호출 */
function ask(ex, done, opts = {}) {
  const body = $('#body'), foot = $('#foot');
  body.innerHTML = ''; foot.innerHTML = ''; foot.className = 'foot'; body.scrollTop = 0;
  body.append(el('div', 'qtitle', ex.title || ''));
  const btn = el('button', 'btn primary', '확인'); btn.disabled = true;
  let skip = null;
  if (opts.skippable) skip = el('button', 'btn ghost', '모르겠어요');
  foot.append(btn); if (skip) foot.append(skip);

  let phase = 'ask', check = () => {}, lock = () => {}, answer = '';
  const finish = (ok, detail, extra) => {
    phase = 'fb'; lock();
    foot.className = 'foot ' + (ok ? 'ok' : 'bad');
    foot.innerHTML = '';
    const fb = el('div', 'fb'); fb.append(el('b', '', ok ? pick(['정답!', '잘했어요!', '좋아요!']) : '아쉬워요'));
    if (detail) fb.append(el('div', '', detail));
    if (extra) fb.append(el('div', 'why', extra));
    const c = el('button', 'btn ' + (ok ? 'primary' : 'danger'), '계속');
    c.onclick = () => { keyHandler = null; done(ok); };
    foot.append(fb, c);
  };
  btn.onclick = () => phase === 'ask' && !btn.disabled && check();

  if (ex.type === 'mcq') {
    const p = el('div', 'prompt'); if (ex.say) p.append(sayBtn(ex.say));
    p.append(el('span', '', ex.prompt)); body.append(p);
    if (ex.say) setTimeout(() => speak(ex.say), 250);
    const opts2 = shuffle(ex.opts.map((t, i) => ({ t, ok: i === ex.a })));
    const list = el('div', 'opts'); let sel = null;
    const bs = opts2.map((o, i) => {
      const b = el('button', 'opt'); b.append(el('span', 'k', i + 1), el('span', '', o.t));
      b.onclick = () => { if (phase !== 'ask') return; sel = o; bs.forEach(x => x.classList.remove('sel')); b.classList.add('sel'); btn.disabled = false; };
      list.append(b); return b;
    });
    body.append(list);
    check = () => {
      bs.forEach((b, i) => { if (opts2[i].ok) b.classList.add('right'); else if (opts2[i] === sel) b.classList.add('wrong'); });
      finish(sel.ok, sel.ok ? '' : mcqDetail(ex, sel), ex.why);
    };
    if (skip) skip.onclick = () => { if (phase !== 'ask') return; sel = { ok: false }; bs.forEach((b, i) => opts2[i].ok && b.classList.add('right')); finish(false, mcqDetail(ex, null), ex.why); };
    keyHandler = e => {
      if (e.key === 'Enter') { phase === 'ask' ? (!btn.disabled && check()) : foot.querySelector('.btn').click(); }
      else if (phase === 'ask' && /^[1-9]$/.test(e.key) && bs[+e.key - 1]) bs[+e.key - 1].click();
    };
  }

  if (ex.type === 'order') {
    body.append(el('div', 'prompt', ex.prompt));
    const slots = el('div', 'slots'), bank = el('div', 'bank');
    body.append(slots, bank);
    const chips = shuffle(ex.words.map((w, i) => ({ w, i }))); let built = [];
    const draw = () => {
      slots.innerHTML = ''; bank.innerHTML = '';
      built.forEach(c => { const b = el('button', 'w', c.w); b.onclick = () => { if (phase === 'ask') { built = built.filter(x => x !== c); draw(); } }; slots.append(b); });
      chips.forEach(c => { const b = el('button', 'w' + (built.includes(c) ? ' used' : ''), c.w); b.onclick = () => { if (phase === 'ask' && !built.includes(c)) { built.push(c); draw(); } }; bank.append(b); });
      btn.disabled = built.length === 0;
    };
    draw();
    check = () => {
      const mine = built.map(c => c.w).join(' '), ok = norm(mine) === norm(ex.ans);
      let d = `내 답: ${mine}\n정답: ${ex.ans}`;
      const a = norm(mine).split(' ').sort().join(' '), b = norm(ex.ans).split(' ').sort().join(' ');
      d += a === b ? '\n단어는 맞아요. 순서를 확인해 보세요.' : '\n빠졌거나 잘못 고른 단어가 있어요.';
      finish(ok, ok ? '' : d, ex.why);
    };
    keyHandler = e => { if (e.key === 'Enter') { phase === 'ask' ? (!btn.disabled && check()) : foot.querySelector('.btn').click(); } };
  }

  if (ex.type === 'type') {
    if (ex.say) { body.append(el('div', 'center').appendChild(sayBtn(ex.say, true)).parentNode); setTimeout(() => speak(ex.say), 300); }
    else body.append(el('div', 'prompt', ex.prompt));
    body.append(el('p', 'hint', '버튼을 눌러 다시 들을 수 있어요'));
    const inp = el('input', 'ans'); inp.autocapitalize = 'off'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = '영어로 입력';
    inp.oninput = () => { btn.disabled = !inp.value.trim(); };
    body.append(inp); setTimeout(() => inp.focus(), 50);
    check = () => {
      const ok = ex.ans.some(a => norm(a) === norm(inp.value));
      let d = `내 답: ${inp.value.trim()}\n정답: ${ex.ans[0]}`;
      const u = norm(inp.value).split(' ').filter(Boolean), t = norm(ex.ans[0]).split(' ');
      if (t.length > 1) {
        const extra = u.filter(w => !t.includes(w)), miss = t.filter(w => !u.includes(w));
        if (extra.length) d += '\n잘못 쓴 단어: ' + extra.join(', ');
        if (miss.length) d += '\n빠지거나 다르게 쓴 단어: ' + miss.join(', ');
      }
      finish(ok, ok ? '' : d, ex.why);
    };
    lock = () => { inp.disabled = true; };
    if (ex.hear) {
      // 소리가 안 나올 때를 위한 건너뛰기: 정답·오답 어느 쪽으로도 세지 않는다
      // 키보드가 올라와도 가려지지 않게 하단 바가 아니라 입력칸 바로 아래에 둔다
      skip = el('button', 'btn', '🔇 지금은 들을 수 없어요 (건너뛰기)'); skip.style.marginTop = '18px'; body.append(skip);
      skip.onclick = () => { if (phase !== 'ask') return; keyHandler = null; done('skip'); };
    } else if (skip) skip.onclick = () => finish(false, '정답: ' + ex.ans[0], ex.why);
    keyHandler = e => { if (e.key === 'Enter') { phase === 'ask' ? (!btn.disabled && check()) : foot.querySelector('.btn').click(); } };
  }
}

/* 말하기 문제는 ask() 안에서 처리하기 위해 확장 */
const _ask = ask;
ask = function (ex, done, opts) {
  if (ex.type !== 'speak') return _ask(ex, done, opts);
  const body = $('#body'), foot = $('#foot');
  body.innerHTML = ''; foot.innerHTML = ''; foot.className = 'foot';
  body.append(el('div', 'qtitle', ex.title));
  const p = el('div', 'prompt'); p.append(sayBtn(ex.say), el('span', '', ex.prompt)); body.append(p);
  const c = el('div', 'center'), mic = el('button', 'say big', '🎤'); c.append(mic); body.append(c);
  const status = el('p', 'hint center', '마이크를 누르고 문장을 읽어 보세요'); status.style.textAlign = 'center'; body.append(status);
  const skip = el('button', 'btn ghost', '지금은 말할 수 없어요'); foot.append(skip);
  let busy = false, over = false;
  skip.onclick = () => { keyHandler = null; done('skip'); };
  keyHandler = null;
  const finish = (ok, detail) => {
    over = true; foot.className = 'foot ' + (ok ? 'ok' : 'bad'); foot.innerHTML = '';
    const fb = el('div', 'fb'); fb.append(el('b', '', ok ? '발음 좋아요!' : '다시 연습해요')); if (detail) fb.append(el('div', '', detail)); if (ex.why) fb.append(el('div', 'why', ex.why));
    const nb = el('button', 'btn ' + (ok ? 'primary' : 'danger'), '계속'); nb.onclick = () => done(ok); foot.append(fb, nb);
  };
  mic.onclick = () => {
    if (busy || over) return; busy = true; speechSynthesis.cancel();
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3;
    status.textContent = '듣는 중... 말해 보세요';
    r.onresult = e => {
      const target = norm(ex.ans[0]).split(' ');
      let best = 0, heard = '';
      [...e.results[0]].forEach(a => { const hw = norm(a.transcript).split(' '); const sc = target.filter(w => hw.includes(w)).length / target.length; if (sc >= best) { best = sc; heard = a.transcript; } });
      finish(best >= 0.8, (best >= 0.8 ? '' : '정답: ' + ex.ans[0] + '\n') + '인식된 문장: ' + heard);
    };
    r.onerror = e => { busy = false; status.textContent = e.error === 'not-allowed' ? '마이크 권한이 필요해요. (HTTPS 주소에서만 동작)' : '인식에 실패했어요. 다시 눌러 주세요.'; };
    r.onend = () => { busy = false; };
    try { r.start(); } catch { busy = false; }
  };
};

/* ---------- 실력 테스트 (처음 = 레벨 배치, 이후 = 실력 점검) ---------- */
function testPool() {
  const out = PLACEMENT.map((r, i) => ({ lv: r[0], q: r[1], o: r[2], a: r[3], why: gExtra([r[1], r[2], r[3], r[4], r[5]]), id: 'p' + i, seen: false }));
  for (const lv in UNITS) UNITS[lv].forEach((u, ui) => {
    const seen = !!S.done[lv + '-' + ui];
    u.g.forEach((g, gi) => out.push({ lv: +lv, q: g[0], o: g[1], a: g[2], why: gExtra(g), id: `u${lv}-${ui}-${gi}`, seen }));
  });
  return out;
}
function startPlacement(isCheck) {
  const check = isCheck === true && !!S.level;
  const N = 15, asked = [], ids = []; let L = check ? S.level : 3, n = 0;
  const used = new Set(), pool = testPool(), recent = new Set(S.recent || []);
  app.innerHTML = '';
  const box = el('div', 'scroll center');
  box.innerHTML = check
    ? '<div class="big">📊</div><div class="h1">실력 점검</div><p class="p">총 15문제예요. 지금까지 배운 것과 앞으로 배울 것이 섞여 나와요.<br>모르는 문제는 찍지 말고 <b>모르겠어요</b>를 눌러 주세요. 그래야 실력이 정확하게 나와요.</p>'
    : '<div class="big">🎯</div><div class="h1">레벨 테스트</div><p class="p">총 15문제예요. 맞히면 어려워지고, 틀리면 쉬워져요.<br>모르는 문제는 찍지 말고 <b>모르겠어요</b>를 눌러 주세요. 그래야 정확한 레벨이 나와요.</p>';
  const go = el('button', 'btn primary', '시작하기'), back = el('button', 'btn ghost', '돌아가기');
  const st = el('div', 'stack'); st.append(go); if (S.level) st.append(back); box.append(st);
  app.append(box);
  back.onclick = home;
  go.onclick = () => {
    const setBar = shell(S.level ? home : () => startPlacement());
    const next = () => {
      setBar(n / N);
      if (n >= N) return placementResult(asked, check, ids);
      let q, d = 0;
      while (!q && d <= 5) {
        const c = pool.filter(x => !used.has(x.id) && Math.abs(x.lv - L) === d);
        const t = c.filter(x => !x.seen && !recent.has(x.id)), t2 = c.filter(x => !recent.has(x.id));
        const arr = t.length ? t : t2.length ? t2 : c;
        if (arr.length) q = pick(arr); else d++;
      }
      used.add(q.id); ids.push(q.id);
      ask({ type: 'mcq', title: `문제 ${n + 1} / ${N}`, prompt: q.q, opts: q.o, a: q.a, why: q.why },
        ok => { asked.push({ lv: q.lv, ok }); L = Math.max(1, Math.min(5, L + (ok ? 1 : -1))); n++; next(); },
        { skippable: true });
    };
    next();
  };
}

function placementResult(asked, check, ids) {
  const last = asked.slice(-8);
  const estF = Math.max(1, Math.min(5, last.reduce((s, a) => s + a.lv, 0) / last.length));
  const est = Math.round(estF), right = asked.filter(a => a.ok).length;
  const prev = (S.tests || []).slice(-1)[0];
  S.tests = (S.tests || []).concat({ d: today(), est: +estF.toFixed(2), right, n: asked.length, lessons: Object.keys(S.done).length }).slice(-30);
  S.recent = (S.recent || []).concat(ids).slice(-45);
  const oldLevel = S.level; if (!check) S.level = est; save(); scheduleSync();
  app.innerHTML = '';
  const box = el('div', 'scroll center');
  const delta = prev ? estF - prev.est : null;
  const dtxt = delta == null ? '' : Math.abs(delta) < 0.05 ? '지난 점검과 비슷해요' : (delta > 0 ? `지난 점검보다 ▲ ${delta.toFixed(1)} 올랐어요!` : `지난 점검보다 ▼ ${Math.abs(delta).toFixed(1)}`);
  let msg = '';
  if (!check) msg = `${LV_DESC[est]}<br>이 레벨부터 학습을 시작해요. 너무 쉽거나 어려우면 홈에서 바꿀 수 있어요.`;
  else if (est > oldLevel) msg = `현재 Lv.${oldLevel}보다 실력이 높아요. Lv.${est}로 올려서 더 도전해 보세요!`;
  else if (est < oldLevel) msg = `지금 레벨이 조금 어려울 수 있어요. 복습하며 천천히 가거나 Lv.${est}로 내려도 좋아요.`;
  else msg = '현재 레벨에 잘 맞아요. 이대로 계속 가면 돼요!';
  box.innerHTML = `<div class="big">${check && delta > 0.05 ? '📈' : '🎉'}</div><div class="h1">${check ? '실력 점검 결과' : '테스트 완료!'}</div>
    <p class="p">${asked.length}문제 중 ${right}문제 정답</p>
    <div class="stats"><div class="stat"><b>Lv ${estF.toFixed(1)}</b><span>${LV_NAME[est]}</span></div></div>
    ${dtxt ? `<p class="p"><b>${dtxt}</b></p>` : ''}<p class="p">${msg}</p>`;
  const st = el('div', 'stack');
  if (check && est > oldLevel) { const u = el('button', 'btn primary', `Lv.${est}로 올리기`); u.onclick = () => { S.level = est; save(); home(); }; st.append(u); }
  const b = el('button', 'btn ' + (check && est > oldLevel ? '' : 'primary'), check ? '홈으로' : '학습 시작'); b.onclick = home; st.append(b);
  box.append(st); app.append(box);
}

/* ---------- 홈 ---------- */
function unlocked(lv, i) { return i === 0 || S.done[lv + '-' + (i - 1)]; }
function doneCount() { return Object.keys(S.done).length; }
function skillCard() {
  const c = el('div', 'skill');
  const t = S.tests || [], last = t[t.length - 1], prev = t[t.length - 2];
  const words = Object.values(S.vocab || {}).filter(v => v.c >= 2).length;
  const h = (S.hist || []).slice(-10);
  const acc = h.length ? Math.round(h.reduce((s, x) => s + x.acc, 0) / h.length) : null;
  const since = last ? doneCount() - (last.lessons || 0) : doneCount();
  const dueTest = since >= 10;
  let spark = '';
  if (t.length >= 2) {
    const pts = t.slice(-10), W = 150, H = 44;
    const lo = Math.min(...pts.map(p => p.est)) - 0.2, hi = Math.max(...pts.map(p => p.est)) + 0.2;
    const xy = pts.map((p, i) => `${(i / (pts.length - 1) * (W - 8) + 4).toFixed(1)},${(H - 4 - (p.est - lo) / (hi - lo) * (H - 8)).toFixed(1)}`);
    spark = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline fill="none" stroke="var(--blue)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${xy.join(' ')}"/><circle cx="${xy[xy.length - 1].split(',')[0]}" cy="${xy[xy.length - 1].split(',')[1]}" r="4.5" fill="var(--blue)"/></svg>`;
  }
  const delta = last && prev ? last.est - prev.est : null;
  const dtxt = delta == null ? '' : Math.abs(delta) < 0.05 ? '변화 없음' : (delta > 0 ? `▲ ${delta.toFixed(1)}` : `▼ ${Math.abs(delta).toFixed(1)}`);
  c.innerHTML = `<div class="skh"><b>📊 내 실력</b><span>${last ? `마지막 점검 ${last.d.replace(/-/g, '.')}` : '아직 점검 전'}</span></div>
    <div class="skm"><div><div class="skn">${last ? 'Lv ' + last.est.toFixed(1) : '—'}</div><div class="sks">${last ? LV_NAME[Math.round(last.est)] + (dtxt ? ' · ' + dtxt : '') : '실력 점검을 해 보세요'}</div></div>${spark}</div>
    <div class="skrow"><div><b>${words}</b><span>익힌 단어</span></div><div><b>${acc == null ? '-' : acc + '%'}</b><span>최근 정확도</span></div><div><b>${doneCount()}</b><span>완료 레슨</span></div></div>`;
  const b = el('button', 'btn' + (dueTest ? ' primary' : ''), dueTest ? `📊 실력 점검할 때가 됐어요 (${since}레슨 지남)` : '📊 실력 점검하기 (15문제)');
  b.style.marginTop = '12px'; b.onclick = () => startPlacement(true); c.append(b);
  return c;
}
let viewCh = null, viewLv = null;
function home() {
  keyHandler = null;
  if (!S.level) return startPlacement();
  const lv = S.level;
  app.innerHTML = '';
  const top = el('div', 'topbar');
  const lvb = el('button', 'chip lv', `Lv.${lv} ${LV_NAME[lv]} ▾`); lvb.onclick = levelSheet;
  const right = el('div'); right.style.cssText = 'display:flex;gap:6px';
  const gear = el('button', 'chip', '⚙️'); gear.onclick = settingsSheet;
  right.append(el('div', 'chip fire', '🔥 ' + S.streak), el('div', 'chip xp', '⭐ ' + S.xp), gear);
  top.append(lvb, right);
  const sc = el('div', 'scroll');
  const doneN = UNITS[lv].filter((_, i) => S.done[lv + '-' + i]).length;
  const nextI = UNITS[lv].findIndex((_, i) => !S.done[lv + '-' + i]);
  const ban = el('div', 'banner');
  const todayDone = S.todayD === today() ? S.todayN : 0;
  ban.innerHTML = nextI < 0
    ? `<small>${LV_DESC[lv]}</small><b>🎊 이 레벨을 모두 마쳤어요!</b>`
    : `<small>▶ 다음 레슨 · 유닛 ${nextI + 1}${todayDone ? ` · 오늘 ${todayDone}레슨 완료` : ''}</small><b>${UNITS[lv][nextI].i} ${UNITS[lv][nextI].t}</b>`;
  if (nextI >= 0) { ban.style.cursor = 'pointer'; ban.onclick = () => lessonIntro(lv, nextI); }
  sc.append(ban, skillCard());
  // 챕터 선택 (10유닛씩)
  const nCh = Math.ceil(UNITS[lv].length / CH);
  if (viewLv !== lv) { viewLv = lv; viewCh = null; }
  const curCh = viewCh != null ? viewCh : Math.floor((nextI < 0 ? UNITS[lv].length - 1 : nextI) / CH);
  if (nCh > 1) {
    const tabs = el('div', 'chtabs');
    for (let c = 0; c < nCh; c++) {
      const from = c * CH, to = Math.min(UNITS[lv].length, from + CH);
      const full = UNITS[lv].slice(from, to).every((_, k) => S.done[lv + '-' + (from + k)]);
      const b = el('button', 'chtab' + (c === curCh ? ' cur' : '') + (full ? ' full' : ''), full ? '✓' + (c + 1) : String(c + 1));
      b.onclick = () => { viewCh = c; home(); }; tabs.append(b);
    }
    sc.append(el('div', 'sec', `챕터 ${curCh + 1} / ${nCh}`), tabs);
  }
  const path = el('div', 'path'); const off = [0, 36, 56, 36];
  const from = curCh * CH, to = Math.min(UNITS[lv].length, from + CH);
  for (let i = from; i < to; i++) {
    const u = UNITS[lv][i];
    const node = el('div', 'node'); node.style.transform = `translateX(${off[(i - from) % 4]}px)`;
    const ok = unlocked(lv, i), done = S.done[lv + '-' + i];
    const c = el('button', 'circle' + (done ? ' done' : '') + (ok ? '' : ' locked'), ok ? (done ? '✓' : u.i) : '🔒');
    if (ok) c.onclick = () => lessonIntro(lv, i);
    node.append(c, el('div', 'nt', `${i + 1}. ${u.t}`)); path.append(node);
  }
  sc.append(path);
  const st = el('div', 'stack');
  if (S.wrong.length) { const r = el('button', 'btn', `🔁 틀린 문제 복습 (${S.wrong.length})`); r.onclick = runReview; st.append(r); }
  if (nextI < 0 && lv < 5) { const u = el('button', 'btn primary', `Lv.${lv + 1} 로 올라가기`); u.onclick = () => { S.level = lv + 1; save(); home(); }; st.append(u); }
  const bk = el('button', 'btn ghost', '☁️ 백업 · 복원'); bk.onclick = backupSheet; st.append(bk);
  sc.append(st);
  if (ghCfg().token) { const sn = el('div', 'note', syncMsg); sn.id = 'syncnote'; sc.append(sn); }
  sc.append(el('div', 'note', `진행 ${doneN} / ${UNITS[lv].length} 유닛 · 기록은 이 기기에 저장돼요`));
  app.append(top, sc);
}

function settingsSheet() {
  const ov = el('div', 'overlay'), sh = el('div', 'sheet'); ov.append(sh);
  sh.append(el('h3', '', '⚙️ 설정'));
  const row = (title, desc, key) => {
    const r = el('button', 'lvrow'); const sw = el('span', 'sw');
    const paint = () => { sw.className = 'sw' + (cfg()[key] ? ' on' : ''); sw.textContent = cfg()[key] ? '켜짐' : '꺼짐'; };
    r.innerHTML = `<span><b>${title}</b><small>${desc}</small></span>`; r.append(sw); paint();
    r.onclick = () => { cfg()[key] = !cfg()[key]; save(); applyWhy(); paint(); };
    sh.append(r);
  };
  row('정답 후 번역·해설', '답을 낸 뒤(맞든 틀리든) 예문 번역과 해설을 보여줘요. 공부 중에도 상단 💡로 바꿀 수 있어요.', 'why');
  row('레슨 전 단어 미리보기', '레슨을 시작하기 전에 단어와 문장을 먼저 보여줘요. 끄면 바로 문제가 나와요.', 'preview');
  const c = el('button', 'btn ghost', '닫기'); c.onclick = () => ov.remove(); sh.append(c);
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}
function levelSheet() {
  const ov = el('div', 'overlay'), sh = el('div', 'sheet'); ov.append(sh);
  sh.append(el('h3', '', '레벨 선택'));
  for (let l = 1; l <= 5; l++) {
    const r = el('button', 'lvrow' + (l === S.level ? ' cur' : ''));
    r.innerHTML = `<span><b>Lv.${l} ${LV_NAME[l]}</b><small>${LV_DESC[l]}</small></span>`;
    r.onclick = () => { S.level = l; save(); ov.remove(); home(); }; sh.append(r);
  }
  const t = el('button', 'btn', '레벨 테스트 다시 보기'); t.onclick = () => { ov.remove(); startPlacement(true); };
  const rs = el('button', 'btn ghost', '모든 기록 초기화'); rs.onclick = () => { if (confirm('XP, 연속일, 진행 상황이 모두 지워져요. 계속할까요?')) { S = fresh(); save(); ov.remove(); home(); } };
  sh.append(t, rs);
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}

/* ---------- GitHub 동기화 (자동 백업 · 복원) ----------
   기록(S)을 내 비공개 저장소의 progress.json 과 주고받는다.
   올리기 전에 서버 기록과 먼저 합쳐서(merge.js) 다른 기기의 기록을 덮어쓰지 않는다.
   토큰은 이 기기 localStorage에만 두며, 백업 파일에는 포함하지 않는다. */
const GH_KEY = 'my-english-gh', GH_REPO = 'hjcho86/my-english-data', GH_PATH = 'progress.json';
const ghCfg = () => { try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch { return {}; } };
const ghSet = c => { try { localStorage.setItem(GH_KEY, JSON.stringify(c)); } catch {} };
const ghUrl = () => `https://api.github.com/repos/${GH_REPO}/contents/${GH_PATH}`;
const ghHead = (tok, raw) => ({ Authorization: 'Bearer ' + tok, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
const b64 = s => btoa(unescape(encodeURIComponent(s)));
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/\n/g, ''))));
function ghErr(status) {
  const e = new Error(status === 401 || status === 403 ? '토큰이 올바르지 않거나 권한이 없어요' : status === 404 ? '저장소를 찾을 수 없어요 (토큰 권한을 확인하세요)' : '오류가 발생했어요 (' + status + ')');
  e.status = status; return e;
}
async function ghGetRemote(tok) { // 서버 기록과 파일 버전(sha)
  const g = await fetch(ghUrl() + '?t=' + Date.now(), { headers: ghHead(tok), cache: 'no-store' });
  if (g.status === 404) return { data: null, sha: null };
  if (!g.ok) throw ghErr(g.status);
  const j = await g.json();
  let text;
  if (j.content) text = unb64(j.content);
  else { const r = await fetch(ghUrl() + '?t=' + Date.now(), { headers: ghHead(tok, true), cache: 'no-store' }); if (!r.ok) throw ghErr(r.status); text = await r.text(); }
  return { data: JSON.parse(text), sha: j.sha };
}
async function ghPut(tok, obj, sha) {
  const body = { message: 'backup ' + new Date().toISOString(), content: b64(JSON.stringify(obj)) };
  if (sha) body.sha = sha;
  const p = await fetch(ghUrl(), { method: 'PUT', headers: { ...ghHead(tok), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (p.status === 409 || p.status === 422) { const e = ghErr(p.status); e.conflict = true; throw e; } // 그 사이 다른 기기가 올림
  if (!p.ok) throw ghErr(p.status);
}

let syncBusy = false, syncMsg = '', syncAt = 0, syncTimer = null;
const autoOn = () => !!ghCfg().token && cfg().auto;
function setSync(msg) { syncMsg = msg; const n = document.getElementById('syncnote'); if (n) n.textContent = msg; }
const hhmm = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

/* 서버 기록과 합친 뒤 필요하면 이 기기·서버를 갱신한다 */
async function syncNow() {
  const tok = ghCfg().token; if (!tok) throw Object.assign(new Error('토큰을 먼저 입력해 주세요'), { status: 1 });
  if (syncBusy) return { skipped: true };
  syncBusy = true;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, sha } = await ghGetRemote(tok);
      const merged = data ? mergeState(S, data) : S;
      const needLocal = stateSig(merged) !== stateSig(S);
      const needUpload = !data || stateSig(merged) !== stateSig(data);
      if (needLocal) { S = Object.assign(fresh(), merged); save(true); }
      if (needUpload) {
        try { await ghPut(tok, S, sha); } catch (e) { if (e.conflict && attempt === 0) continue; throw e; }
      }
      ghSet({ ...ghCfg(), last: new Date().toLocaleString('ko-KR') }); syncAt = Date.now();
      return { changedLocal: needLocal, uploaded: needUpload };
    }
  } finally { syncBusy = false; }
}
async function autoSync() {
  if (!autoOn() || syncBusy) return;
  setSync('☁️ 동기화 중...');
  try {
    const r = await syncNow();
    setSync('☁️ 동기화됨 ' + hhmm());
    if (r && r.changedLocal && document.querySelector('.topbar')) home(); // 홈 화면일 때만 새 기록으로 다시 그림
  } catch (e) { setSync('⚠️ 동기화 실패: ' + (e.status ? e.message : '오프라인')); }
}
function scheduleSync(ms = 2500) { if (!autoOn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(autoSync, ms); }
// 앱을 열 때 / 다시 앞으로 올 때 가져오고, 백그라운드로 갈 때 올린다
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { clearTimeout(syncTimer); autoSync(); }
  else if (Date.now() - syncAt > 60000) autoSync();
});

function backupSheet() {
  const cfgG = ghCfg();
  const ov = el('div', 'overlay'), sh = el('div', 'sheet'); ov.append(sh);
  sh.append(el('h3', '', '☁️ 백업 · 동기화'));
  sh.append(el('p', 'hint', '학습 기록을 내 GitHub 비공개 저장소와 자동으로 주고받아요. 여러 기기에서 써도 기록이 합쳐져요.'));
  const inp = el('input', 'ans'); inp.type = 'password'; inp.placeholder = 'GitHub 토큰 (처음 한 번만 입력)';
  inp.autocomplete = 'off'; inp.autocapitalize = 'off'; inp.spellcheck = false; inp.value = cfgG.token || '';
  const status = el('div', 'hint', cfgG.last ? '마지막 동기화: ' + cfgG.last : '아직 동기화한 적이 없어요');
  sh.append(inp);
  // 자동 동기화 스위치
  const r = el('button', 'lvrow'), sw = el('span', 'sw');
  const paint = () => { sw.className = 'sw' + (cfg().auto ? ' on' : ''); sw.textContent = cfg().auto ? '켜짐' : '꺼짐'; };
  r.innerHTML = '<span><b>자동 동기화</b><small>앱을 열 때, 레슨을 끝낼 때, 앱을 닫을 때 자동으로 합쳐요.</small></span>'; r.append(sw); paint();
  r.onclick = () => { cfg().auto = !cfg().auto; save(); paint(); if (cfg().auto) scheduleSync(300); };
  sh.append(r, status);
  const now = el('button', 'btn primary', '🔄 지금 동기화'), restore = el('button', 'btn ghost', '⬇️ 서버 기록으로 덮어쓰기 (복원)'), close = el('button', 'btn ghost', '닫기');
  sh.append(now, restore, close);
  const busy = on => { now.disabled = restore.disabled = on; };
  const tokenOk = () => { const t = inp.value.trim(); if (!t) { status.textContent = '토큰을 먼저 입력해 주세요'; return null; } ghSet({ ...ghCfg(), token: t }); return t; };
  const fail = e => { status.textContent = '⚠️ ' + (e.status ? e.message : '인터넷 연결을 확인해 주세요'); busy(false); };
  now.onclick = async () => {
    if (!tokenOk()) return; busy(true); status.textContent = '동기화 중...';
    try {
      const res = await syncNow();
      const t = ghCfg().last; status.textContent = res && res.skipped ? '이미 동기화 중이에요' : '✅ 동기화 완료 · ' + t; setSync('☁️ 동기화됨 ' + hhmm()); busy(false);
      if (res && res.changedLocal) { ov.remove(); home(); }
    } catch (e) { fail(e); }
  };
  restore.onclick = async () => {
    const t = tokenOk(); if (!t) return; busy(true); status.textContent = '가져오는 중...';
    try {
      const { data } = await ghGetRemote(t);
      if (!data) throw Object.assign(new Error('저장된 백업이 아직 없어요'), { status: 404 });
      if (typeof data.done !== 'object' || data.done === null) throw Object.assign(new Error('백업 파일 형식이 올바르지 않아요'), { status: 1 });
      const mine = Object.keys(S.done).length, theirs = Object.keys(data.done).length;
      if (!confirm(`서버 기록으로 덮어쓰기\n\n현재 이 기기: ${mine}레슨 · XP ${S.xp}\n서버 기록: ${theirs}레슨 · XP ${data.xp || 0}\n\n이 기기 기록은 사라져요. 계속할까요?`)) { status.textContent = '취소했어요'; busy(false); return; }
      S = Object.assign(fresh(), data); save(true); ov.remove(); home();
    } catch (e) { fail(e); }
  };
  close.onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.append(ov);
}

/* ---------- 레슨 ---------- */
function lessonIntro(lv, ui) {
  if (!cfg().preview) return runSession(buildLesson(lv, ui), { lv, ui }); // 설정에서 미리보기를 켠 경우에만 단어 목록을 먼저 보여줌
  const u = UNITS[lv][ui]; app.innerHTML = '';
  const sc = el('div', 'scroll');
  sc.append(el('div', 'h1', `${u.i} ${u.t}`), el('p', 'p', '먼저 단어와 문장을 훑어보세요. 🔊를 누르면 발음을 들을 수 있어요.'));
  sc.append(el('div', 'sec', '단어'));
  const vl = el('div', 'vlist');
  u.v.forEach(([e, m]) => { const r = el('div', 'vrow'); const d = el('div'); d.append(el('div', 'e', e), el('div', 'm', m)); r.append(sayBtn(e), d); vl.append(r); });
  sc.append(vl, el('div', 'sec', '문장'));
  const sl = el('div', 'vlist');
  u.s.forEach(([e, m]) => { const r = el('div', 'vrow'); const d = el('div'); d.append(el('div', 'e', e), el('div', 'm', m)); r.append(sayBtn(e), d); sl.append(r); });
  sc.append(sl);
  const go = el('button', 'btn primary', '레슨 시작'), bk = el('button', 'btn ghost', '뒤로');
  go.onclick = () => runSession(buildLesson(lv, ui), { lv, ui }); bk.onclick = home;
  const st = el('div', 'stack'); st.append(go, bk); sc.append(st);
  app.append(sc);
}

function recordWrong(ex) {
  if (S.wrong.some(w => w.k === ex.k)) return;
  const { retry, ...c } = ex; S.wrong.push(c); if (S.wrong.length > 60) S.wrong.shift();
}
function clearWrong(ex) { S.wrong = S.wrong.filter(w => w.k !== ex.k); }

function runReview() {
  const items = shuffle(S.wrong).slice(0, 10);
  runSession(items, { review: true });
}

function runSession(exs, meta) {
  const setBar = shell(home); const total = exs.length; const q = exs.slice();
  let doneN = 0, mistakes = 0;
  const step = () => {
    setBar(doneN / total);
    if (!q.length) return complete();
    const ex = q.shift();
    ask(ex, ok => {
      if (ok === 'skip') { doneN++; step(); return; } // 듣기·말하기 건너뛰기: 채점·기록 없이 진행
      if (ex.vw) { const v = S.vocab[ex.vw] || (S.vocab[ex.vw] = { c: 0, w: 0 }); ok ? v.c++ : v.w++; }
      if (ok) { doneN++; clearWrong(ex); }
      else {
        mistakes++; recordWrong(ex);
        const t = (ex.tries || 0) + 1;
        if (t < 3) q.push({ ...ex, tries: t }); else doneN++;
      }
      save(); step();
    });
  };
  const complete = () => {
    keyHandler = null; touchStreak();
    const acc = Math.max(0, Math.round((1 - mistakes / (total + mistakes)) * 100));
    const gain = meta.review ? 5 : 10 + (mistakes <= 2 ? 5 : 0);
    S.xp += gain;
    S.hist = (S.hist || []).concat({ d: today(), acc, review: !!meta.review }).slice(-60);
    if (!meta.review) {
      S.done[meta.lv + '-' + meta.ui] = (S.done[meta.lv + '-' + meta.ui] || 0) + 1;
      S.todayN = (S.todayD === today() ? S.todayN : 0) + 1; S.todayD = today(); viewCh = null;
    }
    save(); scheduleSync();
    app.innerHTML = '';
    const box = el('div', 'scroll center');
    box.innerHTML = `<div class="big">${acc >= 90 ? '🏆' : '🎉'}</div><div class="h1">${meta.review ? '복습 완료!' : '레슨 완료!'}</div>
      <div class="stats"><div class="stat"><b>+${gain}</b><span>XP</span></div><div class="stat"><b>${acc}%</b><span>정확도</span></div><div class="stat"><b>${S.streak}</b><span>연속 일수</span></div></div>`;
    const st = el('div', 'stack');
    // 하루 제한 없이 바로 다음 레슨으로 이어하기 (레벨 끝이면 다음 레벨 첫 유닛)
    let nxt = null;
    if (!meta.review) {
      if (meta.ui + 1 < UNITS[meta.lv].length) nxt = [meta.lv, meta.ui + 1];
      else if (meta.lv < 5) nxt = [meta.lv + 1, 0];
    }
    const lastOfCh = !meta.review && ((meta.ui + 1) % CH === 0 || meta.ui + 1 === UNITS[meta.lv].length);
    const lastT = (S.tests || []).slice(-1)[0], since = doneCount() - (lastT ? lastT.lessons || 0 : 0);
    if (lastOfCh || since >= 10) {
      box.insertAdjacentHTML('beforeend', `<p class="p">${lastOfCh ? '🎯 챕터를 마쳤어요!' : ''} 실력이 얼마나 늘었는지 확인해 볼까요? (${since}레슨 동안 점검 안 함)</p>`);
      const tb = el('button', 'btn primary', '📊 실력 점검하기'); tb.onclick = () => startPlacement(true); st.append(tb);
    }
    if (nxt) {
      const nb = el('button', 'btn' + (lastOfCh || since >= 10 ? '' : ' primary'), '▶ 다음 레슨 계속');
      nb.onclick = () => { if (nxt[0] !== S.level) { S.level = nxt[0]; save(); } lessonIntro(nxt[0], nxt[1]); }; st.append(nb);
    }
    const b = el('button', 'btn ' + (nxt || lastOfCh ? 'ghost' : 'primary'), nxt ? '홈으로' : '계속'); b.onclick = home; st.append(b);
    box.append(st); app.append(box);
  };
  step();
}

home();
autoSync(); // 앱을 열 때 서버 기록과 합침
