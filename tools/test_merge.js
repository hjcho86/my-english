const { mergeState, sig } = require('../merge.js');
let fail = 0; const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log((ok ? '통과 ' : '실패 ') + name + (ok ? '' : `\n   got ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`)); };
const base = o => Object.assign({ level: 3, done: {}, xp: 0, streak: 0, last: null, wrong: [], vocab: {}, tests: [], hist: [], recent: [], settings: { why: true }, rev: 0 }, o);

// 1) 폰과 PC가 서로 다른 레슨을 했을 때 둘 다 살아남는다
let A = base({ done: { '3-0': 1, '3-1': 1 }, xp: 30, rev: 200 }), B = base({ done: { '3-0': 1, '3-2': 1 }, xp: 25, rev: 100 });
let M = mergeState(A, B);
eq('끝낸 유닛 합집합', Object.keys(M.done).sort(), ['3-0', '3-1', '3-2']);
eq('XP는 큰 쪽', M.xp, 30);

// 2) 같은 단어 기록은 큰 쪽, 서로 다른 단어는 모두 유지
A = base({ vocab: { map: { c: 3, w: 1 }, cat: { c: 1, w: 0 } }, rev: 2 }); B = base({ vocab: { map: { c: 2, w: 2 }, dog: { c: 5, w: 0 } }, rev: 1 });
M = mergeState(A, B); eq('단어 기록', M.vocab, { map: { c: 3, w: 2 }, cat: { c: 1, w: 0 }, dog: { c: 5, w: 0 } });

// 3) 연속 학습일: 마지막 학습일이 더 늦은 쪽
A = base({ done: { '1-0': 1 }, streak: 4, last: '2026-11-9', rev: 1 }); B = base({ done: { '1-0': 1 }, streak: 6, last: '2026-11-10', rev: 5 });
M = mergeState(A, B); eq('연속일(늦은 날 우선)', [M.streak, M.last], [6, '2026-11-10']);
A.rev = 9; M = mergeState(A, B); eq('연속일은 rev와 무관', [M.streak, M.last], [6, '2026-11-10']);

// 4) 레벨·설정은 더 최근에 수정한 쪽
A = base({ level: 4, done: { '4-0': 1 }, settings: { why: false }, rev: 50 }); B = base({ level: 2, done: { '2-0': 1 }, settings: { why: true }, rev: 10 });
M = mergeState(A, B); eq('레벨/설정은 최근 수정 쪽', [M.level, M.settings.why], [4, false]);

// 5) 새 기기(기록 없음) ↔ 서버: 서버 기록을 그대로 받는다
const empty = base({ level: null, rev: 999 });
B = base({ level: 3, done: { '3-0': 1 }, xp: 50, rev: 1 });
eq('새 기기는 서버 기록 수용', mergeState(empty, B).xp, 50);
eq('서버가 비어 있으면 이 기기 기록 유지', mergeState(B, empty).xp, 50);

// 6) 틀린 문제·점검 기록 중복 제거
const w = k => ({ k, type: 'mcq' });
A = base({ done: { a: 1 }, wrong: [w('x'), w('y')], tests: [{ d: '1', est: 2.5, right: 8, n: 15 }], rev: 2 });
B = base({ done: { a: 1 }, wrong: [w('y'), w('z')], tests: [{ d: '1', est: 2.5, right: 8, n: 15 }, { d: '2', est: 3, right: 9, n: 15 }], rev: 1 });
M = mergeState(A, B); eq('틀린 문제 합집합', M.wrong.map(x => x.k).sort(), ['x', 'y', 'z']); eq('점검 기록 중복 제거', M.tests.length, 2);

// 7) 멱등성: 합친 결과를 다시 합쳐도 같은 내용 (무한 업로드 방지)
const M2 = mergeState(M, B); eq('멱등성', sig(M2), sig(mergeState(M2, M2)));
eq('키 순서가 달라도 같은 서명', sig({ a: 1, b: { c: 2, d: 3 }, rev: 5 }), sig({ rev: 9, b: { d: 3, c: 2 }, a: 1 }));
// 8) 변경이 없으면 합쳐도 그대로(불필요한 업로드 방지): 오늘 기록이 없는 상태에서도 키가 늘지 않는다
A = base({ done: { a: 1 }, rev: 3 }); B = JSON.parse(JSON.stringify(A)); B.rev = 1;
eq('변경 없음 → 서명 동일', sig(mergeState(A, B)), sig(A));
console.log(fail ? `\n${fail}건 실패` : '\n모두 통과'); process.exit(fail ? 1 : 0);
