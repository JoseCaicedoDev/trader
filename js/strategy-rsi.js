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
          entryMode = 'single', scaleLevels = [26, 22], shallowLevel = 35 } = params;
  const rsi = calculateRSI(data, rsiPeriod);
  const trendVwap = calculateRollingVWAP(data, trendVwapPeriod);
  const exitVwap = exitMode === 'vwap' ? calculateRollingVWAP(data, exitVwapPeriod) : null;
  const n = data.length;

  const trendUp = i => i >= trendLookback && trendVwap[i] !== null && trendVwap[i - trendLookback] !== null
    && trendVwap[i] > trendVwap[i - trendLookback];
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

  const deepBooks = () => [buildBook(scaleLevels[0], 'RSI_TRANCHE_1'), buildBook(scaleLevels[1], 'RSI_TRANCHE_2')];
  const backtest = entryMode === 'tranches3'
    ? mergeTranches([buildBook(shallowLevel, 'RSI_TRANCHE_SHALLOW', true), ...deepBooks()], initialCapital)
    : entryMode === 'scaled'
      ? mergeTranches(deepBooks(), initialCapital)
      : buildBook(entryLevel, 'RSI_DIP_BUY');
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

  const closed = backtest.trades.filter(t => t.type === 'SELL');
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

  const exitLevel = exitMode === 'rsi' ? exitRsi : exitRsiCap;
  const entryLevels = entryMode === 'tranches3' ? [shallowLevel, ...scaleLevels]
    : entryMode === 'scaled' ? scaleLevels : [entryLevel];
  backtest.indicators = [
    { name: `VWAP (${trendVwapPeriod}) tendencia`, type: 'line', data: trendVwap, color: '#00e5ff' },
    ...(exitVwap ? [{ name: `VWAP (${exitVwapPeriod}) salida`, type: 'line', data: exitVwap, color: '#ffca28', style: 2 }] : []),
    { name: `RSI (${rsiPeriod})`, type: 'line', data: rsi, color: '#b388ff',
      priceScaleId: 'rsi', levels: [...entryLevels, exitLevel] }
  ];

  // Open tranches (0, 1 or 2). Their average entry is what the position panel shows.
  const last = n - 1;
  const openByBook = new Map();
  for (const t of backtest.trades) {
    const book = t.book || 'strategy';
    if (t.type === 'BUY') openByBook.set(book, t); else openByBook.delete(book);
  }
  const open = [...openByBook.values()];
  const avgEntry = open.length ? open.reduce((s, t) => s + t.price, 0) / open.length : null;
  backtest.currentState = {
    price: data[last].close,
    rsi: rsi[last],
    overbought,
    oversold,
    entryLevel: entryLevels[0],
    trendUp: trendUp(last),
    trendVwap: trendVwap[last],
    trendVwapPeriod,
    // Live alert hook: a buy on the last candle in any book.
    signal: backtest.trades.some(t => t.type === 'BUY' && t.index === last) ? 'BUY' : null,
    openTrade: avgEntry !== null ? {
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
function mergeTranches(books, initialCapital) {
  const w = 1 / books.length;
  const equityCurve = books[0].equityCurve.map((p, i) => ({
    time: p.time, value: books.reduce((s, b) => s + w * b.equityCurve[i].value, 0)
  }));
  let peak = initialCapital, maxDd = 0;
  for (const p of equityCurve) {
    if (p.value > peak) peak = p.value;
    maxDd = Math.max(maxDd, (peak - p.value) / peak);
  }
  const trades = books
    .flatMap((b, k) => b.trades.map(t => ({ ...t, book: `tramo${k + 1}`, pnl: t.pnl * w })))
    .map(t => ({ ...t, accountEquity: equityCurve[t.index].value }))
    .sort((a, b) => a.index - b.index || a.book.localeCompare(b.book));
  let gp = 0, gl = 0;
  for (const t of trades) if (t.type === 'SELL') { if (t.pnl > 0) gp += t.pnl; else gl -= t.pnl; }
  return {
    trades,
    equityCurve,
    eventLabels: books[0].eventLabels.map((l, i) => l || books.slice(1).map(b => b.eventLabels[i]).find(Boolean) || null),
    finalBalance: books.reduce((s, b) => s + w * b.finalBalance, 0),
    maxDrawdown: maxDd * 100,
    profitFactor: gl === 0 ? (gp > 0 ? Infinity : 1) : gp / gl,
    totalTrades: trades.filter(t => t.type === 'SELL').length
  };
}
