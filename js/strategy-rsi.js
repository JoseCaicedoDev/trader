// Strategy: RSI dip-buying inside a VWAP uptrend (BTC/USDT 4h). Long only, no stop and no target.
//
// Entry: RSI crosses DOWN below `entryLevel` while the long rolling VWAP (`trendVwapPeriod` candles)
// sits above where it was `trendLookback` candles earlier, i.e. only dips inside a rising trend are
// bought. Without that gate the rule bought oversold readings in bear markets, which produced every
// large loss of the original 30/70 rule.
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
          exitMode, exitRsi, exitVwapPeriod, exitRsiCap, analysisStart = 0 } = params;
  const rsi = calculateRSI(data, rsiPeriod);
  const trendVwap = calculateRollingVWAP(data, trendVwapPeriod);
  const exitVwap = exitMode === 'vwap' ? calculateRollingVWAP(data, exitVwapPeriod) : null;
  const n = data.length;

  const trendUp = i => i >= trendLookback && trendVwap[i] !== null && trendVwap[i - trendLookback] !== null
    && trendVwap[i] > trendVwap[i - trendLookback];
  const crossUp = (series, level, i) => series[i - 1] <= level && series[i] > level;

  const signals = new Array(n).fill(null);
  const labels = new Array(n).fill(null);

  let firstIdx = n, inPos = false;
  let overboughtEvents = 0, oversoldEvents = 0, candlesOverbought = 0, candlesOversold = 0, counted = 0;

  for (let i = 1; i < n; i++) {
    if (data[i].time * 1000 < analysisStart || rsi[i] === null || rsi[i - 1] === null) continue;
    if (firstIdx === n) firstIdx = i;
    counted++;
    if (rsi[i] > overbought) candlesOverbought++;
    if (rsi[i] < oversold) candlesOversold++;
    if (crossUp(rsi, overbought, i)) overboughtEvents++;
    if (rsi[i - 1] >= oversold && rsi[i] < oversold) oversoldEvents++;

    if (inPos) {
      let label = null;
      if (exitMode === 'rsi') {
        if (crossUp(rsi, exitRsi, i)) label = 'RSI_EXIT';
      } else {
        const c = data[i].close, cp = data[i - 1].close;
        if (exitVwap[i] !== null && exitVwap[i - 1] !== null && cp <= exitVwap[i - 1] && c > exitVwap[i]) label = 'VWAP_EXIT';
        else if (crossUp(rsi, exitRsiCap, i)) label = 'RSI_EXIT';
      }
      if (label) {
        signals[i] = 'EXIT_LONG_MOMENTUM';
        labels[i] = label;
        inPos = false;
      }
    } else if (rsi[i - 1] >= entryLevel && rsi[i] < entryLevel && trendUp(i)) {
      signals[i] = 'BUY';
      labels[i] = 'RSI_DIP_BUY';
      inPos = true;
    }
  }

  const eventLabels = labels.slice();
  const backtest = runSimulator(data, signals, initialCapital, feePercent, null, null, eventLabels);

  for (const trade of backtest.trades) {
    if (!trade.eventCode && labels[trade.index]) trade.eventCode = labels[trade.index];
  }

  const closed = backtest.trades.filter(t => t.type === 'SELL');
  const winners = closed.filter(t => t.pnl > 0);
  const losers = closed.filter(t => t.pnl <= 0);
  const sumPct = list => list.reduce((s, t) => s + t.pnlPercent, 0);

  backtest.eventLabels = eventLabels;
  backtest.rsiStats = {
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
  backtest.indicators = [
    { name: `VWAP (${trendVwapPeriod}) tendencia`, type: 'line', data: trendVwap, color: '#00e5ff' },
    ...(exitVwap ? [{ name: `VWAP (${exitVwapPeriod}) salida`, type: 'line', data: exitVwap, color: '#ffca28', style: 2 }] : []),
    { name: `RSI (${rsiPeriod})`, type: 'line', data: rsi, color: '#b388ff',
      priceScaleId: 'rsi', levels: [entryLevel, exitLevel] }
  ];

  const last = n - 1;
  const lastTrade = backtest.trades[backtest.trades.length - 1];
  const openTrade = lastTrade && lastTrade.type === 'BUY' ? lastTrade : null;
  backtest.currentState = {
    price: data[last].close,
    rsi: rsi[last],
    overbought,
    oversold,
    entryLevel,
    trendUp: trendUp(last),
    trendVwap: trendVwap[last],
    trendVwapPeriod,
    signal: signals[last],
    openTrade: openTrade ? {
      direction: 'LONG',
      entryPrice: openTrade.price,
      stopLoss: null,
      takeProfit: null,
      unrealizedPct: (data[last].close - openTrade.price) / openTrade.price * 100
    } : null
  };

  return backtest;
}
