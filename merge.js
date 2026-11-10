/* 두 기기의 학습 기록을 합친다. 순수 함수라서 node에서도 테스트할 수 있다.
   a = 이 기기, b = 서버(GitHub)에 있는 기록. 어느 쪽 기록도 줄어들지 않게 합친다. */
(function (root) {
  function parseDay(s) {
    if (!s) return 0;
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1).getTime() || 0;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  function isEmpty(x) { return !x || (!x.level && !Object.keys(x.done || {}).length && !((x.xp || 0) > 0)); }

  function mergeState(a, b) {
    if (isEmpty(a)) return clone(b || a);
    if (isEmpty(b)) return clone(a);
    const newer = (a.rev || 0) >= (b.rev || 0) ? a : b, older = newer === a ? b : a;
    const m = clone(newer); // 단순 값(레벨, 설정 등)은 더 최근에 수정한 쪽을 따른다
    if (!m.level) m.level = older.level;

    // 끝낸 유닛: 합집합, 횟수는 큰 쪽
    m.done = {};
    [a.done || {}, b.done || {}].forEach(src => { for (const k in src) m.done[k] = Math.max(m.done[k] || 0, src[k] || 0); });
    m.xp = Math.max(a.xp || 0, b.xp || 0);

    // 연속 학습일: 마지막 학습일이 더 늦은 쪽
    const da = parseDay(a.last), db = parseDay(b.last);
    if (da !== db) { const w = da > db ? a : b; m.last = w.last; m.streak = w.streak; }
    else { m.last = a.last || b.last; m.streak = Math.max(a.streak || 0, b.streak || 0); }

    // 오늘 한 레슨 수: 같은 날이면 큰 값, 다른 날이면 더 늦은 날
    if (a.todayD || b.todayD) {
      const ta = parseDay(a.todayD), tb = parseDay(b.todayD);
      if (ta === tb) { m.todayD = a.todayD || b.todayD; m.todayN = Math.max(a.todayN || 0, b.todayN || 0); }
      else { const w = ta > tb ? a : b; m.todayD = w.todayD; m.todayN = w.todayN; }
    }

    // 단어별 맞힌/틀린 횟수: 큰 쪽
    m.vocab = {};
    [a.vocab || {}, b.vocab || {}].forEach(src => {
      for (const w in src) {
        const v = m.vocab[w] || (m.vocab[w] = { c: 0, w: 0 });
        v.c = Math.max(v.c, src[w].c || 0); v.w = Math.max(v.w, src[w].w || 0);
      }
    });

    // 틀린 문제: 합집합 (최근 60개)
    const seen = new Set(); m.wrong = [];
    [...(older.wrong || []), ...(newer.wrong || [])].forEach(w => { if (w && !seen.has(w.k)) { seen.add(w.k); m.wrong.push(w); } });
    m.wrong = m.wrong.slice(-60);

    // 실력 점검 기록, 레슨 정확도 기록: 중복 없이 이어 붙임
    const uniq = (arr, cap) => { const s = new Set(), out = []; arr.forEach(x => { const k = JSON.stringify(x); if (!s.has(k)) { s.add(k); out.push(x); } }); return out.slice(-cap); };
    m.tests = uniq([...(older.tests || []), ...(newer.tests || [])], 30);
    m.hist = uniq([...(older.hist || []), ...(newer.hist || [])], 60);
    m.recent = newer.recent || older.recent || [];
    m.settings = Object.assign({}, older.settings, newer.settings);
    m.rev = Math.max(a.rev || 0, b.rev || 0);
    return m;
  }

  // 키 순서와 상관없이 같은 내용이면 같은 문자열 (rev는 비교에서 제외)
  function sig(o) {
    const norm = v => Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((r, k) => (k === 'rev' ? r : (r[k] = norm(v[k]), r)), {}) : v;
    return JSON.stringify(norm(o));
  }

  root.mergeState = mergeState; root.stateSig = sig;
  if (typeof module !== 'undefined') module.exports = { mergeState, sig };
})(typeof window !== 'undefined' ? window : globalThis);
