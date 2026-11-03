// Research only: does not change application rules. Run: node analysis/rsi-study.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const ctx = vm.createContext({});
for (const file of ['indicators.js', 'simulator.js', 'strategy-rsi.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), ctx);
}
const END = Date.parse('2026-11-03T00:00:00Z');
const START = Date.parse('2018-01-01T00:00:00Z');
const BAR = 14400000;
const base = { period: 14, low: 30, high: 70, entry: 'down', exit: 'touch', stop: 0, trend: false };
// Fixed small hypothesis set, declared before fetching/evaluating data.
const variants = [
  { id: 'actual', ...base },
  { ...base, id: 'rebote', entry: 'up' },
  { ...base, id: 'rebote_salida_retorno', entry: 'up', exit: 'return' },
  { ...base, id: 'actual_stop3', stop: 3 },
  { ...base, id: 'rebote_stop3', entry: 'up', stop: 3 },
  { ...base, id: 'rebote_stop3_ema200', entry: 'up', stop: 3, trend: true },
  { ...base, id: 'rebote_ema200', entry: 'up', trend: true },
  { ...base, id: 'rebote_stop3_salida_retorno', entry: 'up', exit: 'return', stop: 3 },
  { ...base, id: 'rsi7_rebote_stop3', period: 7, entry: 'up', stop: 3 },
  { ...base, id: 'rsi14_35_65_rebote_stop3', low: 35, high: 65, entry: 'up', stop: 3 }
];

function simulate(data, indicators, p, start, end, fee = .001, slip = .0005, sameClose = false) {
  const { rsi, atr, ema } = indicators;
  let cash = 100, units = 0, entryEquity = 0, entryTime = 0, stop = null, pending = null;
  let peak = 100, dd = 0, exposed = 0, count = 0;
  const trades = [];
  const curve = [];
  const window = data.map((c, i) => ({ c, i })).filter(({c}) => c.time * 1000 >= start && (c.time * 1000 + BAR) <= end);
  function sell(c, price, reason) {
    cash = units * price * (1 - slip) * (1 - fee);
    trades.push({ entryTime, exitTime: c.time, reason, pnl: cash - entryEquity,
      pct: (cash / entryEquity - 1) * 100, hours: (c.time - entryTime) / 3600 });
    units = 0; stop = null;
  }
  function execute(c, order, price) {
    if (order?.type === 'sell' && units) sell(c, price, 'RSI');
    if (order?.type === 'buy' && !units) {
      entryEquity = cash; entryTime = c.time;
      const fill = price * (1 + slip);
      units = cash * (1 - fee) / fill; cash = 0;
      stop = p.stop ? fill - p.stop * order.atr : null;
    }
  }
  for (const { c, i } of window) {
    count++;
    if (!sameClose) execute(c, pending, c.open);
    pending = null;
    if (units) exposed++;
    if (units && stop !== null && c.low <= stop) sell(c, Math.min(c.open, stop), 'STOP');
    const a = rsi[i - 1], b = rsi[i];
    if (a != null && b != null) {
      const enter = p.entry === 'down' ? a >= p.low && b < p.low : a <= p.low && b > p.low;
      const exit = p.exit === 'touch' ? a <= p.high && b > p.high : a >= p.high && b < p.high;
      if (units && exit) pending = { type: 'sell' };
      else if (!units && enter && (!p.trend || (ema[i] != null && c.close > ema[i])) && (!p.stop || atr[i] != null)) pending = { type: 'buy', atr: atr[i] };
    }
    if (sameClose) { execute(c, pending, c.close); pending = null; }
    const equity = cash + units * c.close;
    peak = Math.max(peak, equity); dd = Math.max(dd, (peak - equity) / peak * 100);
    curve.push(equity);
  }
  const signalTrades = trades.length;
  const last = window.at(-1)?.c;
  if (units) sell(last, last.close, 'END'); // Included in all metrics; END is a valuation liquidation.
  peak = Math.max(peak, cash); dd = Math.max(dd, (peak - cash) / peak * 100);
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0);
  const profit = wins.reduce((s,t) => s+t.pnl,0), loss = -losses.reduce((s,t) => s+t.pnl,0);
  const years = window.length ? (window.at(-1).c.time*1000 + BAR - window[0].c.time*1000) / (365.25 * 86400000) : 0;
  const cagr = years ? (Math.pow(cash / 100, 1 / years) - 1) * 100 : 0;
  const first = window[0]?.c;
  const hold = first ? ((last.close * (1-slip) * (1-fee) * (1-fee)) / (first.open * (1+slip)) - 1) * 100 : 0;
  return { returnPct: cash-100, cagr, dd, calmar: dd ? cagr/dd : 0, n: trades.length, signalTrades,
    winPct: trades.length ? wins.length/trades.length*100 : 0,
    pf: loss ? profit/loss : null, meanTradePct: trades.length ? trades.reduce((s,t)=>s+t.pct,0)/trades.length : 0,
    exposurePct: count ? exposed/count*100 : 0, holdPct: hold, trades };
}

async function main() {
  const cache = path.join(__dirname, 'btc-usdt-4h.json');
  let raw;
  if (fs.existsSync(cache)) raw = JSON.parse(fs.readFileSync(cache));
  else {
    raw = [];
    for (let cursor = START; cursor < END;) {
      const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=1000&startTime=${cursor}&endTime=${END-1}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Binance ${res.status}`);
      const page = await res.json();
      if (!page.length) break;
      raw.push(...page); cursor = page.at(-1)[0] + BAR;
    }
    fs.writeFileSync(cache, JSON.stringify(raw));
  }
  raw = raw.filter(r => r[6] < END);
  assert(raw.length > 10000, 'Insufficient history');
  const gaps=[];
  for (let i=1;i<raw.length;i++) {
    const step=raw[i][0]-raw[i-1][0];
    assert(step>=BAR && step%BAR===0,'Duplicate or misaligned candle');
    if(step>BAR) gaps.push({from:new Date(raw[i-1][0]).toISOString(),to:new Date(raw[i][0]).toISOString(),missingBars:step/BAR-1});
  }
  const data = raw.map(r => ({time:r[0]/1000,open:+r[1],high:+r[2],low:+r[3],close:+r[4],volume:+r[5]}));
  const end = Math.min(END, (data.at(-1).time*1000)+BAR);
  const ind = p => ({rsi:ctx.calculateRSI(data,p.period),atr:ctx.calculateATR(data,14),ema:ctx.calculateEMA(data,200)});
  const splits = { development: [Date.parse('2019-01-01Z'),Date.parse('2025-01-01Z')], evaluation:[Date.parse('2025-01-01Z'),end], full:[Date.parse('2019-01-01Z'),end], latest365:[end-365*86400000,end] };
  const results = variants.map(p => {
    const indicators=ind(p), row={id:p.id,params:p};
    for (const [name,[start,finish]] of Object.entries(splits)) row[name]=simulate(data,indicators,p,start,finish);
    row.annual={};
    for(let year=2019;year<=2026;year++) {
      const s=Date.parse(`${year}-01-01Z`), e=Math.min(Date.parse(`${year+1}-01-01Z`),end);
      if(e>s) row.annual[year]=simulate(data,indicators,p,s,e);
    }
    row.highCosts=simulate(data,indicators,p,...splits.evaluation,.002,.001);
    return row;
  });
  // Development-only ranking. The final period never participates in selection.
  const eligible=results.filter(r=>r.development.n>=30);
  eligible.sort((a,b)=>b.development.calmar-a.development.calmar);
  const selected=eligible[0];
  // Independent implementation must reproduce production's close-fill baseline.
  const start=splits.latest365[0], production=ctx.runRsiZoneStrategy(data,{rsiPeriod:14,oversold:30,overbought:70,analysisStart:start},100,.001);
  const parity=simulate(data,ind(base),base,start,end,.001,0,true);
  assert(Math.abs(parity.returnPct-(production.finalBalance-100))<1e-8,'Production baseline parity');
  const tiny=[{time:0,open:100,high:101,low:99,close:100},{time:14400,open:100,high:101,low:99,close:100},{time:28800,open:120,high:121,low:119,close:120},{time:43200,open:80,high:81,low:79,close:80}];
  const probe=simulate(tiny,{rsi:[40,20,40,40],atr:[2,2,2,2],ema:[]},{...base,stop:3},0,4*BAR,0,0);
  assert.equal(probe.trades[0].entryTime,28800,'Must fill following open');
  assert.equal(probe.trades[0].reason,'STOP');
  assert(Math.abs(probe.returnPct+100/3)<1e-8,'Gap stop must fill at open');
  // Seeded moving-block bootstrap of trade percentage means, exploratory only.
  let seed=42; const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const ts=selected.evaluation.trades.map(t=>t.pct), means=[];
  for(let b=0;b<10000 && ts.length;b++) {
    const draw=[];
    while(draw.length<ts.length) {const j=Math.floor(rand()*ts.length);for(let k=0;k<5 && draw.length<ts.length;k++)draw.push(ts[(j+k)%ts.length]);}
    means.push(draw.reduce((a,b)=>a+b,0)/draw.length);
  }
  means.sort((a,b)=>a-b);
  const output={cutoff:new Date(end).toISOString(),first:new Date(data[0].time*1000).toISOString(),candles:data.length,
    sha256:crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex'),gaps,splits,fee:.001,slippage:.0005,
    developmentSelected:selected.id,bootstrapMeanTrade95:[means[250],means[9750]],productionParity:true,executionChecks:true,results};
  fs.writeFileSync(path.join(__dirname,'rsi-results.json'),JSON.stringify(output,null,2));
  console.log(JSON.stringify({cutoff:output.cutoff,candles:data.length,selected:selected.id,bootstrap:output.bootstrapMeanTrade95,checks:true}));
  console.table(results.map(r=>({id:r.id,devCalmar:r.development.calmar.toFixed(2),devReturn:r.development.returnPct.toFixed(1),evalReturn:r.evaluation.returnPct.toFixed(1),evalDD:r.evaluation.dd.toFixed(1),evalN:r.evaluation.n,evalWin:r.evaluation.winPct.toFixed(1),evalPF:r.evaluation.pf?.toFixed(2),latest:r.latest365.returnPct.toFixed(1),full:r.full.returnPct.toFixed(1),stress:r.highCosts.returnPct.toFixed(1)})));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
