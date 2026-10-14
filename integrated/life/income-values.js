// このコードは，年度別の入力済み金額だけを保存し，数値専用JSONを検証します．
window.PlanIncome = (() => {
  const fields = ['gross', 'net', 'retirementNet'];
  const amount = value => value === '' || value == null ? null : typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12 ? value : null;
  const validYear = year => Number.isInteger(Number(year)) && Number(year) >= 1900 && Number(year) <= 2300;
  const validMode = mode => typeof mode === 'string' && mode.length > 0 && mode.length <= 80 && !/[.\[\]]/.test(mode) && !['__proto__', 'constructor', 'prototype'].includes(mode);
  const row = value => Object.fromEntries(fields.map(key => [key, amount(value?.[key])]));
  function normalize(plan) {
    const legacy = plan.incomeSchema !== 1;
    let needsReview = false;
    plan.parents = (plan.parents || []).map((p, i) => {
      const patterns = {};
      for (const [mode, old] of Object.entries(p.patterns || {})) {
        if (!validMode(mode)) continue;
        const years = {};
        for (const [year, value] of Object.entries(old.years || {})) if (validYear(year)) years[year] = row(value);
        if (legacy) {
          for (const [year, values] of Object.entries(p.yearly || {})) {
            if (validYear(year) && amount(values?.[mode]) !== null) years[year] = {...(years[year] || row()), net: amount(values[mode])};
          }
          const year = Number(old.startYear || plan.startYear);
          if (validYear(year) && amount(old.base) !== null) {
            const key = old.amountType === '手取り' ? 'net' : 'gross';
            years[year] ||= row();
            if (years[year][key] === null) years[year][key] = amount(old.base);
          }
          needsReview = true;
        }
        patterns[mode] = {years};
      }
      if (!Object.keys(patterns).length) patterns['働き方1'] = {years:{}};
      const stages = (p.stages || []).filter(s => validYear(s.startYear) && (Object.hasOwn(patterns, s.mode) || ['無収入', '専業主婦'].includes(s.mode))).map(s => ({startYear:Number(s.startYear), mode:s.mode}));
      return {name:String(p.name || (i ? 'パートナー' : '本人')), birthYear:Number(p.birthYear) || 2001, patterns, stages:stages.length ? stages : [{startYear:Number(plan.startYear), mode:Object.keys(patterns)[0]}]};
    });
    if (legacy && amount(plan.retirement?.payout) > 0) {
      const year = Number(plan.startYear) + Number(plan.retirement.age) - Number(plan.baseAge);
      const p = plan.parents[0];
      if (p && validYear(year)) {
        let mode = Object.keys(p.patterns)[0];
        for (const s of [...p.stages].sort((a,b)=>a.startYear-b.startYear)) if (s.startYear <= year) mode = s.mode;
        if (!Object.hasOwn(p.patterns, mode)) p.patterns[mode] = {years:{}};
        const years = p.patterns[mode].years;
        years[year] ||= row();
        years[year].retirementNet = amount(plan.retirement.payout);
      }
    }
    delete plan.taxBrackets;
    delete plan.retirement;
    plan.incomeSchema = 1;
    if (needsReview) plan.incomeValuesReview = true;
    return plan;
  }
  function parse(payload) {
    if (!payload || Array.isArray(payload) || Object.keys(payload).some(k => !['format','version','years'].includes(k)) || payload.format !== 'lifeplan.income.values' || payload.version !== 1 || !Array.isArray(payload.years) || payload.years.length > 401) throw Error('年度別金額のJSONを選んでください');
    const years = {};
    for (const r of payload.years) {
      if (!r || Array.isArray(r) || Object.keys(r).some(k => !['year',...fields].includes(k)) || typeof r.year !== 'number' || !validYear(r.year) || Object.hasOwn(years,r.year)) throw Error('年度が不正，重複，または金額以外の項目があります');
      for (const key of fields) if (r[key] != null && amount(r[key]) === null) throw Error('金額は0以上の数値で入力してください');
      years[r.year] = row(r);
    }
    return years;
  }
  function exportValues(pattern) {
    return {format:'lifeplan.income.values', version:1, years:Object.entries(pattern.years || {}).filter(([year])=>validYear(year)).sort((a,b)=>Number(a[0])-Number(b[0])).map(([year, values])=>({year:Number(year), ...row(values)}))};
  }
  function setPayout(pattern, oldYear, year, value) {
    if (!validYear(year) || amount(value) === null) throw Error('年度は1900〜2300，金額は0以上1兆円以下で入力してください．');
    const years = pattern.years ||= {}, target = String(Number(year));
    if (String(oldYear) !== target && amount(years[target]?.retirementNet) > 0) throw Error('その年度には退職金が登録済みです．登録済みの行を編集してください．');
    if (oldYear != null && String(oldYear) !== target && years[oldYear]) years[oldYear].retirementNet = null;
    years[target] ||= row();
    years[target].retirementNet = value;
  }
  return {normalize, parse, exportValues, row, validMode, setPayout};
})();

