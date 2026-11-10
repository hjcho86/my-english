// 사용:
//   node tools/validate_tr.js content/tr/lv1a.js content/lv1a.js
//   node tools/validate_tr.js content/tr/base.js base
const fs = require('fs'), vm = require('vm'), path = require('path');
const [trFile, target] = process.argv.slice(2);
const errs = [];
const win = {}; const ctx = vm.createContext({ window: win });
vm.runInContext(fs.readFileSync(trFile, 'utf8'), ctx);
const ok = s => typeof s === 'string' && s.length >= 4 && s.length <= 90 && /[가-힣]/.test(s) && !/___/.test(s);
const chk = (s, id) => { if (!ok(s)) errs.push(`${id}: 번역이 비었거나 형식 오류(4~90자, 한글 포함, ___ 금지): ${JSON.stringify(s)}`); };
if (target === 'base') {
  const d = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8') + ';this.U=UNITS;this.P=PLACEMENT', d);
  const B = win.BASE_TR;
  if (!B) errs.push('window.BASE_TR 없음');
  else {
    for (let lv = 1; lv <= 5; lv++) {
      const e = (B.units || {})[lv];
      if (!e || e.length !== d.U[lv].length) { errs.push(`Lv${lv}: 유닛 수 불일치`); continue; }
      d.U[lv].forEach((u, i) => { if (e[i].length !== u.g.length) errs.push(`Lv${lv} 유닛${i + 1}: 개수 불일치`); else e[i].forEach((s, j) => chk(s, `Lv${lv} 유닛${i + 1} 문제${j + 1}`)); });
    }
    if (!B.placement || B.placement.length !== d.P.length) errs.push('placement 개수 불일치');
    else B.placement.forEach((s, i) => { const hasBlank = d.P[i][1].includes('___'); if (hasBlank) chk(s, `placement ${i + 1}`); else if (s !== '') errs.push(`placement ${i + 1}: 빈칸 없는 어휘 문제는 빈 문자열이어야 함`); });
  }
} else {
  const cw = {}; const cc = vm.createContext({ window: cw }); vm.runInContext(fs.readFileSync(target, 'utf8'), cc);
  const part = cw.UNIT_PARTS[0], P = (win.TR_PARTS || [])[0];
  if (!P) errs.push('TR_PARTS 없음');
  else {
    if (P.lv !== part.lv || P.start !== part.start) errs.push('lv/start 불일치');
    if (!P.tr || P.tr.length !== part.units.length) errs.push(`유닛 수 불일치 ${(P.tr || []).length}/${part.units.length}`);
    else part.units.forEach((u, i) => { const e = P.tr[i]; if (!e || e.length !== 4) errs.push(`유닛${i + 1}: 4개 아님`); else e.forEach((s, j) => chk(s, `유닛${i + 1}(${u.t}) 문제${j + 1}`)); });
  }
}
if (errs.length) { errs.slice(0, 40).forEach(e => console.log('오류:', e)); process.exit(1); }
console.log(path.basename(trFile) + ' 검증 통과');
