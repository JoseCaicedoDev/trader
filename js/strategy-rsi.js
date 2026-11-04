// Strategy: RSI dip-buying inside a VWAP uptrend (BTC/USDT 4h). Long only, no stop and no target.
//
// Entry trigger: RSI crosses DOWN below a level while the long rolling VWAP (`trendVwapPeriod`
// candles) sits above where it was `trendLookback` candles earlier, i.e. only dips inside a rising
// trend are bought. Without that gate the rule bought oversold readings in bear markets, which
// produced every large loss of the original 30/70 rule.
//
// Entry, chosen by `entryMode`:
//   'single' — one position with all the capital at `entryLevel`.
//   'scaled' — two independent half-capital tranches: the first buys at `scaleLevels[0]`, the second
//              at the deeper `scaleLevels[1]`; both use the same exit rule. The account is the 50/50
//              blend of the two books, so every figure shown is that of the whole account.
//   'tranches3' — three one-third tranches: a shallow-dip tranche that buys when RSI crosses back UP
//              above `shallowLevel` after being below it (the rebound has to start), plus the two
//              deep tranches of 'scaled'. Built to catch dips that bottom around RSI 33 in an uptrend.
//
// Exit, chosen by `exitMode`:
//   'rsi'  — RSI crosses UP above `exitRsi`.
//   'vwap' — close crosses UP above the short rolling VWAP (`exitVwapPeriod`) OR RSI crosses above
//            `exitRsiCap`, whichever happens first.
//
// Bear-regime short book (`bearShort`), sized like one more tranche (1/3 of the capital): while the long
// VWAP is FALLING (exactly when the long tranches cannot buy) it shorts when RSI crosses back DOWN
// below `bearShortLevel` (a rebound rolling over), and covers when close crosses DOWN below
// VWAP(`bearExitVwapPeriod`) or RSI crosses below `bearExitRsi`, with a fixed `bearStopPct` stop above
// the entry. It never enters while a long tranche is still open (the trend can turn with a long held),
// so the account never holds both and never exceeds 100% exposure. On 5 years of history the guard
// never had to act: the two regimes did not overlap once. Its
// P&L is added on top of the long tranches' blend (see mergeTranches' `overlays`).
//
// Position state is tracked here (not left to the simulator) so an exit and an entry condition on the
// same candle resolve exactly as in the validation engine: while long only exits are evaluated, while
// flat only entries. Only entries at or after `params.analysisStart` (ms) trade; earlier candles exist
// to warm up RSI and the long VWAP.
//
// `rsiStats` additionally counts how often RSI reached overbought (> overbought) and oversold
// (< oversold) in the analysed window, which is what the tab's yearly card shows.
//
// Depends on: indicators.js (calculateRSI, calculateRollingVWAP) and simulator.js (runSimulator).
function runRsiZoneStrategy(data, params, initialCapital, feePercent) {
  const { rsiPeriod, overbought, oversold, entryLevel, trendVwapPeriod, trendLookback,
          exitMode, exitRsi, exitVwapPeriod, exitRsiCap, analysisStart = 0,
          entryMode = 'single', scaleLevels = [26, 22], shallowLevel = 35,
          bearShort = false, bearShortLevel = 70, bearExitVwapPeriod = 80, bearExitRsi = 30, bearStopPct = 5 } = params;
  const rsi = calculateRSI(data, rsiPeriod);
  const trendVwap = calculateRollingVWAP(data, trendVwapPeriod);
  const exitVwap = exitMode === 'vwap' ? calculateRollingVWAP(data, exitVwapPeriod) : null;
  const bearVwap = bearShort
    ? (exitVwap && bearExitVwapPeriod === exitVwapPeriod ? exitVwap : calculateRollingVWAP(data, bearExitVwapPeriod))
    : null;
  const n = data.length;

  const trendUp = i => i >= trendLookback && trendVwap[i] !== null && trendVwap[i - trendLookback] !== null
    && trendVwap[i] > trendVwap[i - trendLookback];
  const trendDown = i => i >= trendLookback && trendVwap[i] !== null && trendVwap[i - trendLookback] !== null
    && trendVwap[i] <= trendVwap[i - trendLookback];
  const crossUp = (series, level, i) => series[i - 1] <= level && series[i] > level;
  const tradable = i => data[i].time * 1000 >= analysisStart && rsi[i] !== null && rsi[i - 1] !== null;

  // One book: buys inside the trend when RSI crosses below `level` (or, with `confirm`, crosses back
  // above it), sells on the exit rule.
  function buildBook(level, entryLabel, confirm = false) {
    const signals = new Array(n).fill(null);
    const labels = new Array(n).fill(null);
    let inPos = false;
    for (let i = 1; i < n; i++) {
      if (!tradable(i)) continue;
      if (inPos) {
        let label = null;
        if (exitMode === 'rsi') {
          if (crossUp(rsi, exitRsi, i)) label = 'RSI_EXIT';
        } else {
          const c = data[i].close, cp = data[i - 1].close;
          if (exitVwap[i] !== null && exitVwap[i - 1] !== null && cp <= exitVwap[i - 1] && c > exitVwap[i]) label = 'VWAP_EXIT';
          else if (crossUp(rsi, exitRsiCap, i)) label = 'RSI_EXIT';
        }
        if (label) { signals[i] = 'EXIT_LONG_MOMENTUM'; labels[i] = label; inPos = false; }
      } else if ((confirm ? crossUp(rsi, level, i) : rsi[i - 1] >= level && rsi[i] < level) && trendUp(i)) {
        signals[i] = 'BUY'; labels[i] = entryLabel; inPos = true;
      }
    }
    const eventLabels = labels.slice();
    const bt = runSimulator(data, signals, initialCapital, feePercent, null, null, eventLabels);
    for (const t of bt.trades) if (!t.eventCode && labels[t.index]) t.eventCode = labels[t.index];
    bt.eventLabels = eventLabels;
    return bt;
  }

  // Short book for the falling-trend regime. The stop is checked first on each candle, as the
  // simulator does, so a stopped position may re-enter on the same candle exactly like the engine.
  function buildShortBook(longOpen) {
    const signals = new Array(n).fill(null);
    const labels = new Array(n).fill(null);
    const stops = new Array(n).fill(null);
    let stop = null;
    for (let i = 1; i < n; i++) {
      if (!tradable(i)) continue;
      if (stop !== null && data[i].high >= stop) stop = null;
      if (stop !== null) {
        const c = data[i].close, cp = data[i - 1].close;
        let label = null;
        if (bearVwap[i] !== null && bearVwap[i - 1] !== null && cp >= bearVwap[i - 1] && c < bearVwap[i]) label = 'VWAP_EXIT';
        else if (rsi[i - 1] >= bearExitRsi && rsi[i] < bearExitRsi) label = 'RSI_EXIT';
        if (label) { signals[i] = 'EXIT_SHORT_MOMENTUM'; labels[i] = label; stop = null; }
      } else if (rsi[i - 1] >= bearShortLevel && rsi[i] < bearShortLevel && trendDown(i) && !longOpen[i]) {
        signals[i] = 'SHORT'; labels[i] = 'RSI_BEAR_SHORT';
        stops[i] = data[i].close * (1 + bearStopPct / 100);
        stop = stops[i];
      }
    }
    const eventLabels = labels.slice();
    const bt = runSimulator(data, signals, initialCapital, feePercent, stops, null, eventLabels);
    for (const t of bt.trades) if (!t.eventCode && eventLabels[t.index]) t.eventCode = eventLabels[t.index];
    bt.eventLabels = eventLabels;
    return bt;
  }

  const deepBooks = () => [buildBook(scaleLevels[0], 'RSI_TRANCHE_1'), buildBook(scaleLevels[1], 'RSI_TRANCHE_2')];
  const longBooks = entryMode === 'tranches3'
    ? [buildBook(shallowLevel, 'RSI_TRANCHE_SHALLOW', true), ...deepBooks()]
    : entryMode === 'scaled' ? deepBooks() : [buildBook(entryLevel, 'RSI_DIP_BUY')];
  // Candles where any long tranche is still open (from its entry up to its exit candle): the short book
  // never enters there, so the account cannot hold a long and a short at once when the trend turns.
  const longOpen = new Array(n).fill(false);
  for (const b of longBooks) {
    let from = null;
    for (const t of b.trades) {
      if (t.type === 'BUY') from = t.index;
      else if (from !== null) { for (let j = from; j <= t.index; j++) longOpen[j] = true; from = null; }
    }
    if (from !== null) for (let j = from; j < n; j++) longOpen[j] = true;
  }
  const overlays = bearShort ? [buildShortBook(longOpen)] : [];
  const backtest = longBooks.length > 1 || overlays.length
    ? mergeTranches(longBooks, initialCapital, overlays)
    : longBooks[0];
  const tranchesTotal = entryMode === 'tranches3' ? 3 : entryMode === 'scaled' ? 2 : 1;

  // Zone statistics of the analysed window (independent of the trading rule).
  let firstIdx = n, overboughtEvents = 0, oversoldEvents = 0, candlesOverbought = 0, candlesOversold = 0, counted = 0;
  for (let i = 1; i < n; i++) {
    if (!tradable(i)) continue;
    if (firstIdx === n) firstIdx = i;
    counted++;
    if (rsi[i] > overbought) candlesOverbought++;
    if (rsi[i] < oversold) candlesOversold++;
    if (crossUp(rsi, overbought, i)) overboughtEvents++;
    if (rsi[i - 1] >= oversold && rsi[i] < oversold) oversoldEvents++;
  }

  const closed = backtest.trades.filter(t => t.type === 'SELL' || t.type === 'COVER');
  const winners = closed.filter(t => t.pnl > 0);
  const losers = closed.filter(t => t.pnl <= 0);
  const sumPct = list => list.reduce((s, t) => s + t.pnlPercent, 0);

  backtest.rsiStats = {
    entryMode,
    from: firstIdx < n ? data[firstIdx].time : null,
    to: data[n - 1].time,
    candles: counted,
    overboughtEvents,
    oversoldEvents,
    pctOverbought: counted ? candlesOverbought / counted * 100 : 0,
    pctOversold: counted ? candlesOversold / counted * 100 : 0,
    winners: winners.length,
    losers: losers.length,
    avgWinPct: winners.length ? sumPct(winners) / winners.length : 0,
    avgLossPct: losers.length ? sumPct(losers) / losers.length : 0,
    bestPct: closed.length ? Math.max(...closed.map(t => t.pnlPercent)) : 0,
    worstPct: closed.length ? Math.min(...closed.map(t => t.pnlPercent)) : 0,
    netPnl: closed.reduce((s, t) => s + t.pnl, 0),
    // Buy-and-hold over the same window, so the strategy's return has something to be judged against.
    buyHoldPct: firstIdx < n ? (data[n - 1].close / data[firstIdx].close - 1) * 100 : 0
  };

  // Long-only tranches: short "Compra" / "+x%" chart markers, merged per candle.
  backtest.compactMarkers = true;

  const exitLevel = exitMode === 'rsi' ? exitRsi : exitRsiCap;
  const entryLevels = entryMode === 'tranches3' ? [shallowLevel, ...scaleLevels]
    : entryMode === 'scaled' ? scaleLevels : [entryLevel];
  const bearLevels = bearShort ? [bearShortLevel, bearExitRsi] : [];
  backtest.indicators = [
    { name: `VWAP (${trendVwapPeriod}) tendencia`, type: 'line', data: trendVwap, color: '#00e5ff' },
    ...(exitVwap ? [{ name: `VWAP (${exitVwapPeriod}) salida`, type: 'line', data: exitVwap, color: '#ffca28', style: 2 }] : []),
    { name: `RSI (${rsiPeriod})`, type: 'line', data: rsi, color: '#b388ff',
      priceScaleId: 'rsi', levels: [...new Set([...entryLevels, exitLevel, ...bearLevels])] }
  ];

  // Open positions: long tranches (their average entry is what the position panel shows) or the bear
  // short, never both at once.
  const last = n - 1;
  const openByBook = new Map();
  for (const t of backtest.trades) {
    const book = t.book || 'strategy';
    if (t.type === 'BUY' || t.type === 'SHORT') openByBook.set(book, t); else openByBook.delete(book);
  }
  const openAll = [...openByBook.values()];
  const openShort = openAll.find(t => t.type === 'SHORT') || null;
  const open = openAll.filter(t => t.type === 'BUY');
  const lastEntry = backtest.trades.find(t => (t.type === 'BUY' || t.type === 'SHORT') && t.index === last);
  const avgEntry = open.length ? open.reduce((s, t) => s + t.price, 0) / open.length : null;
  backtest.currentState = {
    price: data[last].close,
    rsi: rsi[last],
    overbought,
    oversold,
    entryLevel: entryLevels[0],
    trendUp: trendUp(last),
    bearShort,
    trendVwap: trendVwap[last],
    trendVwapPeriod,
    // Live alert hook: a buy on the last candle in any book.
    signal: lastEntry ? lastEntry.type : null,
    openTrade: openShort ? {
      direction: 'SHORT (⅓ capital)',
      entryPrice: openShort.price,
      stopLoss: openShort.price * (1 + bearStopPct / 100),
      takeProfit: null,
      unrealizedPct: (openShort.price - data[last].close) / openShort.price * 100
    } : avgEntry !== null ? {
      direction: tranchesTotal > 1 ? `LONG (${open.length}/${tranchesTotal} tramos)` : 'LONG',
      entryPrice: avgEntry,
      stopLoss: null,
      takeProfit: null,
      unrealizedPct: (data[last].close - avgEntry) / avgEntry * 100
    } : null
  };

  return backtest;
}

// Account made of equal-capital tranches. Each book was simulated with the full capital, so the
// account equals the average of the books; trade P&L in $ is scaled to the tranche's share of the
// account (its % is unchanged), and `accountEquity` is the account balance at that candle.
// `overlays` are books that trade only while every tranche is flat (the bear short): they reuse one
// tranche's share of the idle capital, so only their P&L (equity - initial capital) is added.
function mergeTranches(books, initialCapital, overlays = []) {
  const w = 1 / books.length;
  const all = [...books, ...overlays];
  const equityCurve = books[0].equityCurve.map((p, i) => ({
    time: p.time,
    value: books.reduce((s, b) => s + w * b.equityCurve[i].value, 0)
      + overlays.reduce((s, b) => s + w * (b.equityCurve[i].value - initialCapital), 0)
  }));
  let peak = initialCapital, maxDd = 0;
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value;
    maxDd = Math.max(maxDd, (peak - p.value) / peak);
  }
  const trades = all
    .flatMap((b, k) => b.trades.map(t => ({ ...t, book: k < books.length ? `tramo${k + 1}` : 'bajista', pnl: t.pnl * w })))
    .map(t => ({ ...t, accountEquity: equityCurve[t.index].value }))
    .sort((a, b) => a.index - b.index || a.book.localeCompare(b.book));
  let gp = 0, gl = 0;
  const isClose = t => t.type === 'SELL' || t.type === 'COVER';
  for (const t of trades) if (isClose(t)) { if (t.pnl > 0) gp += t.pnl; else gl -= t.pnl; }
  return {
    trades,
    equityCurve,
    eventLabels: all[0].eventLabels.map((l, i) => l || all.slice(1).map(b => b.eventLabels[i]).find(Boolean) || null),
    finalBalance: books.reduce((s, b) => s + w * b.finalBalance, 0)
      + overlays.reduce((s, b) => s + w * (b.finalBalance - initialCapital), 0),
    maxDrawdown: maxDd * 100,
    profitFactor: gl === 0 ? (gp > 0 ? Infinity : 1) : gp / gl,
    totalTrades: trades.filter(isClose).length
  };
}

// Historical risk of each tranche: the "how bad can it get" view a rule without a stop needs.
// Run on the same Binance 4h candles as the tab, over a longer history (RSI_RISK_HISTORY_START), it
// pairs every BUY with its SELL per book and measures:
//   - win rate against the break-even win rate |avgLoss| / (avgWin + |avgLoss|) and the gap between
//     them (the cushion): with no fixed target, the average win and loss play the role of R;
//   - adverse excursion (MAE): the lowest low between entry and exit relative to the entry price,
//     i.e. how deep each trade went underwater before the exit rule released it;
//   - holding time in days.
// For a tranche that is still open it also reports the current drawdown and the deepest one so far,
// and how many past trades of that tranche went deeper (the context for sitting through a dip).
// `bt` is a runRsiZoneStrategy result on `data`. Books are named tramo1..N in entry-level order.
function computeTrancheRisk(data, bt, bookNames) {
  const quantile = (arr, q) => {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  };
  const lowestLow = (from, to) => {
    let lo = Infinity;
    for (let i = from; i <= to; i++) lo = Math.min(lo, data[i].low);
    return lo;
  };
  const highestHigh = (from, to) => {
    let hi = -Infinity;
    for (let i = from; i <= to; i++) hi = Math.max(hi, data[i].high);
    return hi;
  };
  // Adverse excursion in %, negative = against the position: lows for a long, highs for a short.
  const excursion = (e, to) => e.type === 'SHORT'
    ? -(highestHigh(e.index + 1, to) / e.price - 1) * 100
    : (lowestLow(e.index + 1, to) / e.price - 1) * 100;
  const last = data.length - 1;
  const books = {};
  const open = {};
  for (const t of bt.trades) {
    const b = t.book || 'tramo1';
    books[b] = books[b] || { closed: [], open: null };
    if (t.type === 'BUY' || t.type === 'SHORT') { open[b] = t; continue; }
    const e = open[b];
    if (!e) continue;
    delete open[b];
    books[b].closed.push({
      pnl: t.pnlPercent,
      mae: excursion(e, t.index),
      days: (t.index - e.index) / 6
    });
  }
  for (const [b, e] of Object.entries(open)) {
    books[b] = books[b] || { closed: [], open: null };
    books[b].open = {
      entryTime: data[e.index].time,
      entryPrice: e.price,
      nowPct: (e.type === 'SHORT' ? -1 : 1) * (data[last].close / e.price - 1) * 100,
      maePct: e.index < last ? excursion(e, last) : 0,
      days: (last - e.index) / 6
    };
  }

  // tramo1..N first (entry-level order), then the bear short book.
  const order = Object.keys(books).sort((a, b) => (a === 'bajista') - (b === 'bajista') || a.localeCompare(b));
  return order.map((b, k) => {
    const { closed, open: o } = books[b];
    const wins = closed.filter(x => x.pnl > 0), losses = closed.filter(x => x.pnl <= 0);
    const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
    const avgWin = mean(wins.map(x => x.pnl)), avgLoss = mean(losses.map(x => x.pnl));
    const winRate = closed.length ? wins.length / closed.length * 100 : null;
    const breakEven = avgWin !== null && avgLoss !== null ? -avgLoss / (avgWin - avgLoss) * 100 : null;
    const maes = closed.map(x => x.mae);
    return {
      book: b,
      name: (bookNames && bookNames[k]) || b,
      short: b === 'bajista',
      trades: closed.length,
      winRate,
      avgWin,
      avgLoss,
      breakEven,
      cushion: winRate !== null && breakEven !== null ? winRate - breakEven : null,
      medianDays: quantile(closed.map(x => x.days), 0.5),
      maeMedian: quantile(maes, 0.5),
      maeP90: quantile(maes, 0.1), // 10th percentile of a negative number = the deep 10% of trades
      maeWorst: maes.length ? Math.min(...maes) : null,
      winnersDeepDip: wins.filter(x => x.mae < -5).length,
      winners: wins.length,
      open: o ? { ...o, deeperBefore: maes.filter(m => m < o.maePct).length } : null
    };
  });
}
