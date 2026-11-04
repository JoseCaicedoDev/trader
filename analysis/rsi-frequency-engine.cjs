// Research engine: cash long, next-open fills and completed-roundtrip frequency.
const assert = require('node:assert/strict');
const HOUR = 3600000;

function calendarMonths(start, end) {
  const months = {};
  const d = new Date(start);
  d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() < end) {
    const a = d.getTime(), key = d.toISOString().slice(0, 7);
    d.setUTCMonth(d.getUTCMonth() + 1);
    if (a >= start && d.getTime() <= end) months[key] = 0;
  }
  return months;
}

function openPosition(state, order, bar, config) {
  const price = (config.sameClose ? bar.close : bar.open) * (1 + config.slip);
  state.entryEquity = state.cash;
  state.units = state.cash * (1 - config.fee) / price;
  state.cash = 0; state.entryTime = bar.time; state.entryPrice = price;
  state.stop = config.params.stop ? price - config.params.stop * order.atr : null;
}

function closePosition(state, bar, price, reason, config) {
  state.cash = state.units * price * (1 - config.slip) * (1 - config.fee);
  state.trades.push({ entry: state.entryTime, exit: bar.time, reason,
    pct: (state.cash / state.entryEquity - 1) * 100,
    pnl: state.cash - state.entryEquity, hours: (bar.time - state.entryTime) / 3600 });
  state.units = 0; state.stop = null;
}

function executeOrder(state, order, bar, config) {
  if (order?.side === 'sell' && state.units) {
    closePosition(state, bar, config.sameClose ? bar.close : bar.open, 'SIGNAL', config);
  } else if (order?.side === 'buy' && !state.units) openPosition(state, order, bar, config);
}

function nextSignal(state, source, i, params) {
  const { bars, rsi, atr, trend, exitVwap, lookback } = source;
  const a = rsi[i - 1], b = rsi[i];
  if (a == null || b == null) return null;
  if (state.units) {
    const cross = a <= params.exitRsi && b > params.exitRsi;
    const vwapCross = exitVwap[i] != null && exitVwap[i - 1] != null
      && bars[i - 1].close <= exitVwap[i - 1] && bars[i].close > exitVwap[i];
    if (cross || (params.exitMode === 'vwap' && vwapCross)) return { side: 'sell' };
    return null;
  }
  const cross = params.entry === 'down' ? a >= params.level && b < params.level : a <= params.level && b > params.level;
  const trendOk = !params.trend || (trend[i] != null && trend[i - lookback] != null && trend[i] > trend[i - lookback]);
  return cross && trendOk && (!params.stop || atr[i] != null) ? { side: 'buy', atr: atr[i] } : null;
}

function markEquity(state, bar) {
  const equity = state.cash + state.units * bar.close;
  if (state.trackMonthly) state.monthEquity[new Date(bar.time * 1000).toISOString().slice(0, 7)] = equity;
  state.peak = Math.max(state.peak, equity);
  state.dd = Math.max(state.dd, (state.peak - equity) / state.peak * 100);
}

function simulate(source, params, options) {
  const config = { fee: .001, slip: .0005, sameClose: false, ...options, params };
  const state = { cash: 100, units: 0, stop: null, peak: 100, dd: 0, trades: [], exposed: 0, bars: 0,
    trackMonthly: config.trackMonthly, monthEquity: {} };
  let pending = null, last = null;
  for (let i = 1; i < source.bars.length; i++) {
    const bar = source.bars[i];
    if (bar.time * 1000 < config.start || (bar.time * 1000 + source.hours * HOUR) > config.end) continue;
    last = bar; state.bars++;
    if (!config.sameClose) executeOrder(state, pending, bar, config);
    if (state.units) state.exposed++;
    if (state.units && state.stop != null && bar.low <= state.stop) closePosition(state, bar, Math.min(bar.open, state.stop), 'STOP', config);
    pending = nextSignal(state, source, i, params);
    if (config.sameClose) executeOrder(state, pending, bar, config);
    markEquity(state, bar);
  }
  const openAtEnd = !!state.units;
  if (state.units) closePosition(state, last, last.close, 'END', config);
  markEquity(state, last);
  return summarize(state, config, openAtEnd);
}

function summarize(state, config, openAtEnd) {
  const closed = state.trades.filter(t => t.reason !== 'END');
  const months = calendarMonths(config.start, config.end);
  for (const t of closed) {
    const key = new Date(t.exit * 1000).toISOString().slice(0, 7);
    if (key in months) months[key]++;
  }
  const values = Object.values(months), years = (config.end - config.start) / (365.2425 * 86400000);
  const wins = closed.filter(t => t.pnl > 0), loss = -closed.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0);
  const cagr = (Math.pow(state.cash / 100, 1 / years) - 1) * 100;
  const monthlyReturns = {};
  for (const key of Object.keys(months)) {
    const d = new Date(`${key}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
    const previous = state.monthEquity[d.toISOString().slice(0, 7)];
    if (previous != null) monthlyReturns[key] = (state.monthEquity[key] / previous - 1) * 100;
  }
  return { returnPct: state.cash - 100, cagr, dd: state.dd, calmar: state.dd ? cagr / state.dd : 0, monthlyReturns,
    n: closed.length, avgMonthly: closed.length / (years * 12), months, coverage: values.filter(n => n >= 2).length / values.length,
    zeroMonths: values.filter(n => n === 0).length, minMonth: Math.min(...values), openAtEnd,
    pf: loss ? wins.reduce((a, t) => a + t.pnl, 0) / loss : null, winPct: closed.length ? wins.length / closed.length * 100 : 0,
    meanPct: closed.length ? closed.reduce((a, t) => a + t.pct, 0) / closed.length : 0,
    holdHours: closed.length ? closed.reduce((a, t) => a + t.hours, 0) / closed.length : 0,
    exposurePct: state.exposed / state.bars * 100, trades: state.trades };
}

function checkExecution() {
  const bars = [0, 1, 2, 3].map(i => ({ time: i * 3600, open: 100, high: 101, low: 99, close: 100 }));
  Object.assign(bars[2], { open: 120, high: 121, low: 119, close: 120 });
  Object.assign(bars[3], { open: 80, high: 81, low: 79, close: 80 });
  const source = { bars, hours: 1, rsi: [40, 20, 40, 40], atr: [2, 2, 2, 2], trend: [], exitVwap: [] };
  const p = { level: 30, entry: 'down', trend: 0, exitRsi: 70, exitMode: 'rsi', stop: 3 };
  const r = simulate(source, p, { start: 0, end: 4 * HOUR, fee: 0, slip: 0 });
  assert.equal(r.trades[0].entry, 7200); assert.equal(r.trades[0].reason, 'STOP');
  assert(Math.abs(r.returnPct + 100 / 3) < 1e-9);
  assert.equal(r.n, 1); assert.equal(r.openAtEnd, false);
  const open = simulate(source, { ...p, stop: 0 }, { start: 0, end: 4 * HOUR, fee: 0, slip: 0 });
  assert.equal(open.n, 0, 'End valuation is not a completed signal trade');
  assert.equal(open.openAtEnd, true);
}

module.exports = { simulate, calendarMonths, checkExecution };
