// Strategy: RSI zones (BTC/USDT 4h). Long only, no stop and no target.
//
// Opens a LONG on the candle where RSI crosses DOWN into oversold (< oversold) and closes it on the
// candle where RSI crosses UP into overbought (> overbought): the classic mean-reversion use of RSI.
//
// A position therefore lives from one oversold cross until the next overbought cross. Further
// oversold crosses while long are ignored (the simulator does not pyramid). Only crosses at or after
// `params.analysisStart` (ms) trade; candles before it exist solely to warm up RSI's smoothing.
//
// Besides the backtest, `rsiStats` counts how often each zone was reached in the analysed window, so
// the tab can answer "how many times did BTC go overbought / oversold in the last year".
//
// Depends on: indicators.js (calculateRSI) and simulator.js (runSimulator). Must load after both.
function runRsiZoneStrategy(data, params, initialCapital, feePercent) {
  const { rsiPeriod, overbought, oversold, analysisStart = 0 } = params;
  const rsi = calculateRSI(data, rsiPeriod);
  const n = data.length;

  const signals = new Array(n).fill(null);
  const labels = new Array(n).fill(null);

  let firstIdx = n;
  let overboughtEvents = 0, oversoldEvents = 0, candlesOverbought = 0, candlesOversold = 0, counted = 0;

  for (let i = 1; i < n; i++) {
    if (data[i].time * 1000 < analysisStart || rsi[i] === null) continue;
    if (firstIdx === n) firstIdx = i;
    counted++;
    if (rsi[i] > overbought) candlesOverbought++;
    if (rsi[i] < oversold) candlesOversold++;
    if (rsi[i - 1] === null) continue;

    if (rsi[i - 1] >= oversold && rsi[i] < oversold) {
      oversoldEvents++;
      signals[i] = 'BUY';
      labels[i] = 'RSI_OVERSOLD';
    } else if (rsi[i - 1] <= overbought && rsi[i] > overbought) {
      overboughtEvents++;
      signals[i] = 'EXIT_LONG_MOMENTUM';
      labels[i] = 'RSI_OVERBOUGHT';
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
  backtest.indicators = [
    { name: `RSI (${rsiPeriod})`, type: 'line', data: rsi, color: '#b388ff',
      priceScaleId: 'rsi', levels: [overbought, oversold] }
  ];

  const last = n - 1;
  const lastTrade = backtest.trades[backtest.trades.length - 1];
  const openTrade = lastTrade && lastTrade.type === 'BUY' ? lastTrade : null;
  backtest.currentState = {
    price: data[last].close,
    rsi: rsi[last],
    overbought,
    oversold,
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
