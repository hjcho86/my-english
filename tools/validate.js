// 사용: node tools/validate.js <콘텐츠 파일> <레벨> <기대 유닛 수>
const fs = require('fs'), vm = require('vm'), path = require('path');
const [file, lvArg, cntArg] = process.argv.slice(2);
const lv = +lvArg, expect = +cntArg;
const win = {}; const ctx = vm.createContext({ window: win });
vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
const parts = win.UNIT_PARTS || [];
const errs = [], warns = [];
if (parts.length !== 1) errs.push('UNIT_PARTS에 파트가 정확히 1개여야 함: ' + parts.length);
const part = parts[0] || { units: [] };
if (part.lv !== lv) errs.push('lv 값 불일치: ' + part.lv);
const units = part.units;
if (units.length !== expect) errs.push(`유닛 수 ${units.length} (기대 ${expect})`);

// 기존 data.js의 같은 레벨 단어
const dctx = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') + ';this.U=UNITS', dctx);
const old = new Set((dctx.U[lv] || []).flatMap(u => u.v.map(x => x[0].toLowerCase())));
const seenEn = new Map(), seenKo = new Map();
const isStr = x => typeof x === 'string' && x.trim().length > 0;
units.forEach((u, ui) => {
  const id = `유닛${ui + 1}(${u.t})`;
  if (!isStr(u.t) || !isStr(u.i)) errs.push(id + ': t/i 누락');
  if (!Array.isArray(u.v) || u.v.length !== 8) errs.push(id + ': 단어 8개 아님');
  if (!Array.isArray(u.s) || u.s.length !== 4) errs.push(id + ': 문장 4개 아님');
  if (!Array.isArray(u.g) || u.g.length !== 4) errs.push(id + ': 문법 4개 아님');
  (u.v || []).forEach(p => {
    if (!Array.isArray(p) || p.length !== 2 || !isStr(p[0]) || !isStr(p[1])) return errs.push(id + ': 단어 형식 오류 ' + JSON.stringify(p));
    const e = p[0].toLowerCase(), k = p[1];
    if (old.has(e)) warns.push(`${id}: 기존 유닛과 단어 중복 ${e}`);
    if (seenEn.has(e)) warns.push(`${id}: 단어 중복 ${e} (유닛${seenEn.get(e)})`); else seenEn.set(e, ui + 1);
    if (seenKo.has(k)) warns.push(`${id}: 뜻 중복 "${k}" (유닛${seenKo.get(k)})`); else seenKo.set(k, ui + 1);
  });
  (u.s || []).forEach(p => {
    if (!Array.isArray(p) || p.length !== 2 || !isStr(p[0]) || !isStr(p[1])) return errs.push(id + ': 문장 형식 오류');
    if (!/[.?!]$/.test(p[0])) errs.push(id + ': 문장이 .?!로 끝나지 않음 ' + p[0]);
    const n = p[0].split(' ').length; if (n > 13) errs.push(id + ': 문장 너무 김(' + n + '단어) ' + p[0]);
    if (/[가-힣]/.test(p[0])) errs.push(id + ': 영어 문장에 한글 포함');
    if (/[“”‘’…—]/.test(p[0])) errs.push(id + ': 특수문자(곡선 따옴표 등) 사용 금지 ' + p[0]);
  });
  (u.g || []).forEach(g => {
    if (!Array.isArray(g) || g.length !== 3) return errs.push(id + ': 문법 형식 오류');
    const [q, o, a] = g;
    if ((q.match(/___/g) || []).length !== 1) errs.push(id + ': 빈칸(___)이 정확히 1개여야 함 ' + q);
    if (!Array.isArray(o) || o.length !== 3 || new Set(o).size !== 3 || !o.every(isStr)) errs.push(id + ': 보기 3개(서로 달라야 함) ' + q);
    if (a !== 0) errs.push(id + ': 정답 인덱스는 항상 0 ' + q);
  });
});
console.log(`${path.basename(file)}: 유닛 ${units.length}, 단어 ${seenEn.size}개`);
warns.slice(0, 30).forEach(w => console.log('경고:', w)); if (warns.length > 30) console.log(`경고 ${warns.length - 30}건 더 있음`);
if (errs.length) { errs.slice(0, 60).forEach(e => console.log('오류:', e)); if (errs.length > 60) console.log(`오류 ${errs.length - 60}건 더 있음`); process.exit(1); }
console.log('검증 통과 (경고 ' + warns.length + '건)');
