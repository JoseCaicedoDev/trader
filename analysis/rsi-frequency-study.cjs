// Reproducible five-year research. Does not mutate the application or its parameters.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { simulate, checkExecution } = require('./rsi-frequency-engine.cjs');
const ROOT = path.resolve(__dirname, '..');
const END = Date.parse('2026-11-03T00:00:00Z');
const START = Date.parse('2021-11-03T00:00:00Z');
const CUT1 = Date.parse('2024-11-03T00:00:00Z');
const CUT2 = Date.parse('2025-11-03T00:00:00Z');
const ctx = vm.createContext({});
for (const file of ['indicators.js', 'simulator.js', 'strategy-rsi.js', 'config.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', file), 'utf8'), ctx);
}
const CURRENT = vm.runInContext('JSON.parse(JSON.stringify(RSI_STRATEGY_PARAMS))', ctx);

async function fetchHistory() {
  const cache = path.join(__dirname, 'btc-usdt-1h-five-year.json');
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const raw = [];
  for (let cursor = Date.parse('2021-04-01T00:00:00Z'); cursor < END;) {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=1000&startTime=${cursor}&endTime=${END - 1}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    const page = await response.json();
    if (!page.length) break;
    raw.push(...page); cursor = page.at(-1)[0] + 3600000;
  }
  fs.writeFileSync(cache, JSON.stringify(raw));
  return raw;
}

function aggregate(raw, hours) {
  const bars = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i][0] % (hours * 3600000)) continue;
    const group = raw.slice(i, i + hours);
    if (group.length !== hours || group.at(-1)[0] - group[0][0] !== (hours - 1) * 3600000) continue;
    bars.push({ time: group[0][0] / 1000, open: +group[0][1], close: +group.at(-1)[4],
      high: Math.max(...group.map(r => +r[2])), low: Math.min(...group.map(r => +r[3])),
      volume: group.reduce((s, r) => s + +r[5], 0) });
  }
  return bars;
}

function makeSource(bars, hours) {
  const cache = new Map();
  const get = (key, calculate) => { if (!cache.has(key)) cache.set(key, calculate()); return cache.get(key); };
  return p => ({ bars, hours, lookback: p.lookback ?? Math.round(120 / hours),
    rsi: get(`rsi${p.period}`, () => ctx.calculateRSI(bars, p.period)),
    atr: get('atr', () => ctx.calculateATR(bars, 14)),
    trend: p.trend ? get(`vwap${p.trend}`, () => ctx.calculateRollingVWAP(bars, p.trend)) : [],
    exitVwap: get(`vwap${p.exitVwap}`, () => ctx.calculateRollingVWAP(bars, p.exitVwap)) });
}

function grid() {
  const variants = [];
  for (const hours of [4, 2, 1]) for (const period of [14, 10, 7]) for (const level of [25, 30, 35])
    for (const entry of ['down', 'up']) for (const trendHours of [4000, 2000, 0])
      for (const exit of ['rsi60', 'rsi70', 'vwap65']) for (const stop of [0, 3]) {
        variants.push({ hours, period, level, entry, trend: trendHours / hours, lookback: 120 / hours,
          exitMode: exit.startsWith('vwap') ? 'vwap' : 'rsi', exitRsi: +exit.replace(/\D/g, ''), exitVwap: 400 / hours, stop });
      }
  return variants.map((p, i) => ({ ...p, id: `G${String(i).padStart(4, '0')}` }));
}

function compact(result) {
  const { trades, ...metrics } = result;
  return metrics;
}

function windowOptions(start, end) { return { start, end }; }

function annual(source, p) {
  return Array.from({ length: 5 }, (_, i) => {
    const start = Date.parse(`${2021 + i}-11-03T00:00:00Z`), end = Date.parse(`${2022 + i}-11-03T00:00:00Z`);
    return compact(simulate(source, p, windowOptions(start, end)));
  });
}

function detailed(sources, p) {
  const source = sources[p.hours](p);
  return { params: p, full: simulate(source, p, { start: START, end: END, trackMonthly: true }), annual: annual(source, p),
    development: compact(simulate(source, p, windowOptions(START, CUT1))),
    validation: compact(simulate(source, p, windowOptions(CUT1, CUT2))),
    final: simulate(source, p, { start: CUT2, end: END, trackMonthly: true }),
    stressFull: compact(simulate(source, p, { start: START, end: END, fee: .002, slip: .001 })),
    stressFinal: compact(simulate(source, p, { start: CUT2, end: END, fee: .002, slip: .001 })) };
}

function qualifiesDevelopment(r) {
  return r.development.avgMonthly >= 2 && r.development.coverage >= .5 && r.development.dd <= 35 && r.development.returnPct > 0;
}

function selectCandidates(rows) {
  const ranked = rows.filter(qualifiesDevelopment).sort((a, b) => b.development.calmar - a.development.calmar);
  const shortlist = ranked.slice(0, 10);
  const passed = shortlist.filter(r => r.validation.avgMonthly >= 2 && r.validation.returnPct > 0 && r.validation.dd <= 35 && r.validationStress.returnPct > 0);
  passed.sort((a, b) => b.validation.calmar - a.validation.calmar);
  return { ranked, shortlist, passed, selected: passed[0] ?? ranked[0] ?? null };
}

function expandedSelection(rows) {
  const eligible = rows.filter(qualifiesDevelopment);
  const passed = eligible.filter(r => r.validation.avgMonthly >= 2 && r.validation.returnPct > 0 && r.validation.dd <= 35 && r.validationStress.returnPct > 0);
  passed.sort((a, b) => b.validation.calmar - a.validation.calmar);
  return { passed, selected: passed[0] ?? null };
}

function verifyParity(bars, sources, params) {
  const reference = ctx.runRsiZoneStrategy(bars, { ...CURRENT, analysisStart: START }, 100, .001);
  const simulated = simulate(sources[4](params), params, { start: START, end: END, sameClose: true, slip: 0 });
  assert(Math.abs(reference.finalBalance - (100 + simulated.returnPct)) < 1e-8, 'Production balance parity');
  assert.equal(reference.totalTrades, simulated.n, 'Production roundtrip parity');
  const ref = reference.trades.filter(t => t.type === 'SELL');
  const actual = simulated.trades.filter(t => t.reason !== 'END');
  for (let i = 0; i < ref.length; i++) assert.equal(ref[i].time, actual[i].exit, 'Production exit timing parity');
  return { productionReturn: reference.finalBalance - 100, closed: reference.totalTrades, checks: true };
}

function neighbors(sources, p) {
  const dimensions = { period: [-1, 1], level: [-2, 2], exitRsi: [-2, 2], lookback: [-5, 5] };
  if (p.trend) dimensions.trend = [-Math.round(p.trend * .1), Math.round(p.trend * .1)];
  if (p.stop) dimensions.stop = [-.5, .5];
  if (p.exitMode === 'vwap') dimensions.exitVwap = [-Math.round(p.exitVwap * .2), Math.round(p.exitVwap * .2)];
  return Object.entries(dimensions).flatMap(([key, deltas]) => deltas.map(delta => {
    const params = { ...p, [key]: p[key] + delta };
    return { dimension: key, delta, params, full: compact(simulate(sources[p.hours](params), params, { start: START, end: END })),
      final: compact(simulate(sources[p.hours](params), params, { start: CUT2, end: END })) };
  }));
}

function bootstrapMonthly(result) {
  const returns = Object.values(result.monthlyReturns).map(pct => Math.log1p(pct / 100));
  let seed = 20261103;
  const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const means = [];
  for (let b = 0; b < 10000; b++) {
    const values = [];
    while (values.length < returns.length) { const j = Math.floor(rand() * returns.length); for (let k = 0; k < 3 && values.length < returns.length; k++) values.push(returns[(j + k) % returns.length]); }
    means.push(Math.expm1(values.reduce((s, v) => s + v, 0) / values.length) * 100);
  }
  means.sort((a, b) => a - b);
  return { lower: means[250], upper: means[9750], fullMonths: returns.length, blockMonths: 3, samples: 10000 };
}

function diagnose(source, params) {
  let crosses = 0, accepted = 0, trendBars = 0, bars = 0;
  for (let i = 1; i < source.bars.length; i++) {
    const time = source.bars[i].time * 1000;
    if (time < START || time >= END) continue;
    bars++;
    const trendUp = source.trend[i] != null && source.trend[i - source.lookback] != null && source.trend[i] > source.trend[i - source.lookback];
    if (trendUp) trendBars++;
    if (source.rsi[i - 1] >= params.level && source.rsi[i] < params.level) { crosses++; if (trendUp) accepted++; }
  }
  return { oversoldCrosses: crosses, crossesWithRisingTrend: accepted, percentTimeTrendUp: trendBars / bars * 100 };
}

function retrospect(sources, rows) {
  // Descriptive only: these full-period checks do not feed the train/validation selector.
  return rows.map(row => {
    const p = row.params, source = sources[p.hours](p);
    return { id: p.id, full: compact(simulate(source, p, { start: START, end: END })),
      stress: compact(simulate(source, p, { start: START, end: END, fee: .002, slip: .001 })),
      annual: annual(source, p) };
  });
}

function checkNativeBars(bars) {
  const native = JSON.parse(fs.readFileSync(path.join(__dirname, 'btc-usdt-4h.json'), 'utf8'));
  const byTime = new Map(native.map(r => [r[0] / 1000, r]));
  let checked = 0;
  for (const bar of bars) {
    const reference = byTime.get(bar.time);
    if (!reference) continue;
    for (const [key, index] of [['open', 1], ['high', 2], ['low', 3], ['close', 4]]) assert(Math.abs(bar[key] - +reference[index]) < 1e-7, `Native OHLC ${key} mismatch`);
    checked++;
  }
  return checked;
}

async function main() {
  checkExecution();
  const raw = await fetchHistory();
  const gaps = [];
  for (let i = 1; i < raw.length; i++) {
    const step = raw[i][0] - raw[i - 1][0];
    assert(step >= 3600000 && step % 3600000 === 0, 'Duplicate or misaligned hour');
    if (step > 3600000) gaps.push({ from: new Date(raw[i-1][0]).toISOString(), to: new Date(raw[i][0]).toISOString(), missingHours: step / 3600000 - 1 });
  }
  assert.equal(raw.at(-1)[6], END - 1, 'Wrong cutoff');
  const bars = Object.fromEntries([4, 2, 1].map(h => [h, aggregate(raw, h)]));
  const nativeBarsChecked = checkNativeBars(bars[4]);
  const sources = Object.fromEntries([4, 2, 1].map(h => [h, makeSource(bars[h], h)]));
  const current = { id: 'current', hours: 4, period: CURRENT.rsiPeriod, level: CURRENT.entryLevel, entry: 'down', trend: CURRENT.trendVwapPeriod,
    lookback: CURRENT.trendLookback, exitMode: CURRENT.exitMode, exitRsi: CURRENT.exitMode === 'vwap' ? CURRENT.exitRsiCap : CURRENT.exitRsi, exitVwap: CURRENT.exitVwapPeriod, stop: 0 };
  const parity = verifyParity(bars[4], sources, current);
  const rows = grid().map(p => {
    const source = sources[p.hours](p);
    return { params: p, development: compact(simulate(source, p, { start: START, end: CUT1 })),
      validation: compact(simulate(source, p, { start: CUT1, end: CUT2 })),
      validationStress: compact(simulate(source, p, { start: CUT1, end: CUT2, fee: .002, slip: .001 })) };
  });
  const selection = selectCandidates(rows);
  // Exploratory second stage: the initial top-ten shortlist had no cost-resistant validation survivor.
  // Expand to all development-eligible rows; final-year results never enter this ranking.
  const expanded = expandedSelection(rows);
  const bestByTimeframe = [4, 2, 1].map(h => selectCandidates(rows.filter(r => r.params.hours === h)).selected).filter(Boolean);
  const models = [current, { ...current, id: 'original30_70', level: 30, trend: 0, exitMode: 'rsi', exitRsi: 70 }, ...bestByTimeframe.map(r => r.params), ...(expanded.selected ? [expanded.selected.params] : [])];
  const details = models.map(p => detailed(sources, p));
  const changes = [{ id: 'entry30', level: 30 }, { id: 'entry35', level: 35 }, { id: 'rsi7', period: 7 },
    { id: 'noTrend', trend: 0 }, { id: 'trend500', trend: 500 }, { id: 'exitRsi60', exitMode: 'rsi', exitRsi: 60 }, { id: 'stop3', stop: 3 }];
  const ablations = changes.map(change => detailed(sources, { ...current, ...change }));
  const selected = expanded.selected ? detailed(sources, expanded.selected.params) : null;
  const sensitivity = selected ? neighbors(sources, selected.params) : [];
  const retrospective = retrospect(sources, rows);
  const output = { start: new Date(START).toISOString(), cutoff: new Date(END).toISOString(), hours: raw.length, gaps,
    sha256: crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex'), nativeBarsChecked, currentParams: CURRENT, parity,
    gridSize: rows.length, developmentEligible: selection.ranked.length, validationPassed: selection.passed.length,
    selectedId: selected?.params.id, shortlist: selection.shortlist, expandedValidationPassed: expanded.passed,
    selectionRevision: 'Initial top-ten failed validation stress; exploratory expansion to all 59 development-eligible candidates, ranked on validation only.',
    selected, details, ablations, sensitivity, retrospective, diagnostics: diagnose(sources[4](current), current),
    bootstrapFull: selected ? bootstrapMonthly(selected.full) : null, bootstrapFinal: selected ? bootstrapMonthly(selected.final) : null, rows };
  fs.writeFileSync(path.join(__dirname, 'rsi-frequency-results.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ variants: rows.length, eligible: selection.ranked.length, passed: selection.passed.length, selected: selected?.params, parity }));
  console.table(details.map(r => ({ id: r.params.id, hours: r.params.hours, avg: r.full.avgMonthly.toFixed(2), coverage: (r.full.coverage * 100).toFixed(1), return: r.full.returnPct.toFixed(1), dd: r.full.dd.toFixed(1), pf: r.full.pf?.toFixed(2), final: r.final.returnPct.toFixed(1), finalAvg: r.final.avgMonthly.toFixed(2), stressFinal: r.stressFinal.returnPct.toFixed(1) })));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
