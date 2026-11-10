// 사용:
//   node tools/validate_exp.js content/exp/lv1a.js content/lv1a.js     (콘텐츠 파일용 해설)
//   node tools/validate_exp.js content/exp/base.js base                (data.js 기본 유닛 + 레벨 테스트 해설)
const fs = require('fs'), vm = require('vm'), path = require('path');
const [expFile, target] = process.argv.slice(2);
const errs = [];
const win = {}; const ctx = vm.createContext({ window: win });
vm.runInContext(fs.readFileSync(expFile, 'utf8'), ctx);
const okStr = s => typeof s === 'string' && s.length >= 8 && s.length <= 170 && /[가-힣]/.test(s);
const chk = (s, id) => { if (!okStr(s)) errs.push(`${id}: 해설이 비었거나 너무 짧/긺(8~170자, 한글 포함): ${JSON.stringify(s)}`); };

if (target === 'base') {
  const dctx = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') + ';this.U=UNITS;this.P=PLACEMENT', dctx);
  const B = win.BASE_EXP;
  if (!B) errs.push('window.BASE_EXP 가 없음');
  else {
    for (let lv = 1; lv <= 5; lv++) {
      const units = dctx.U[lv], e = (B.units || {})[lv];
      if (!e || e.length !== units.length) { errs.push(`Lv${lv}: 유닛 수 불일치`); continue; }
      units.forEach((u, i) => { if (e[i].length !== u.g.length) errs.push(`Lv${lv} 유닛${i + 1}: 문법 ${u.g.length}개인데 해설 ${e[i].length}개`); else e[i].forEach((s, j) => chk(s, `Lv${lv} 유닛${i + 1} 문제${j + 1}`)); });
    }
    if (!B.placement || B.placement.length !== dctx.P.length) errs.push(`placement 해설 수 불일치: ${(B.placement || []).length}/${dctx.P.length}`);
    else B.placement.forEach((s, i) => chk(s, `placement ${i + 1}`));
  }
  console.log('base 검증');
} else {
  const cwin = {}; const cctx = vm.createContext({ window: cwin });
  vm.runInContext(fs.readFileSync(target, 'utf8'), cctx);
  const part = cwin.UNIT_PARTS[0], P = (win.EXP_PARTS || [])[0];
  if (!P) errs.push('EXP_PARTS 가 없음');
  else {
    if (P.lv !== part.lv || P.start !== part.start) errs.push(`lv/start 불일치: ${P.lv}/${P.start} vs ${part.lv}/${part.start}`);
    if (!P.exp || P.exp.length !== part.units.length) errs.push(`유닛 수 불일치: ${(P.exp || []).length}/${part.units.length}`);
    else part.units.forEach((u, i) => { const e = P.exp[i]; if (!e || e.length !== 4) errs.push(`유닛${i + 1}(${u.t}): 해설 4개 아님`); else e.forEach((s, j) => chk(s, `유닛${i + 1}(${u.t}) 문제${j + 1}`)); });
  }
  console.log(path.basename(expFile) + ' 검증');
}
if (errs.length) { errs.slice(0, 40).forEach(e => console.log('오류:', e)); if (errs.length > 40) console.log(`오류 ${errs.length - 40}건 더`); process.exit(1); }
console.log('검증 통과');
