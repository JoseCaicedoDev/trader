// Strategy 4: "Oracle Move" — port of the Pine Script "Oracle Move [wm]" indicator, applied to
// BTC/USDT 4h via Binance. The indicator builds a Hull-style double moving average: ma1/ma2 are a
// fast/slow MA of price (half-length and full-length), ma3 = 2*ma1 - ma2 (a de-lagged blend of the
// two), and ma4 is a further MA of ma3 over sqrt(length) — with mode=wma this is exactly the
// classic Hull Moving Average; ema/alma modes are smoother variants of the same construction. The
// original script only plots ma3 (blue) and ma4 (orange) with no built-in signal; this strategy
// treats a cross between the two lines as the trend-turn signal. ma3 is the fast/de-lagged line and
// ma4 is a further MA *of ma3*, i.e. structurally the slow/lagging line of the pair (same fast/slow
// relationship as emaFast/emaSlow in strategy-emacross.js) — so bullish is ma3 crossing above ma4
// (fast over slow), bearish is ma3 crossing below ma4, not the reverse.
//
// VWAP trend gate: a raw ma3/ma4 cross with no confluence filter only reaches ~40% win rate (see
// config.js) — most of its losses are cross signals that fire against the broader trend and get
// immediately reversed. Gating entries on price being on the correct side of a rolling VWAP (the
// same trend filter strategy-emacross.js uses) rejects those counter-trend crosses instead of
// trading them.
//
// Stop/target sizing follows the same ATR-scaled, fixed risk:reward approach as strategy-emacross.js.
//
// Depends on: indicators.js (calculateATR, calculateRollingVWAP, wmaSeries, emaSeries, almaSeries)
// and simulator.js (runSimulator). Must load after both.
function oracleMA(mode, values, period) {
  if (mode === 'alma') return almaSeries(values, period, 0.85, 6);
  if (mode === 'ema') return emaSeries(values, period);
  return wmaSeries(values, period);
}

function runOracleMoveStrategy(data, params, initialCapital, feePercent) {
  const { maLen, maMode, atrPeriod, atrMult, rrRatio, vwapPeriod } = params;
  const n = data.length;
  const closes = data.map(c => c.close);

  const ma1 = oracleMA(maMode, closes, Math.floor(maLen / 2));
  const ma2 = oracleMA(maMode, closes, maLen);
  const ma3 = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (ma1[i] !== null && ma2[i] !== null) ma3[i] = 2 * ma1[i] - ma2[i];
  }
  const ma4 = oracleMA(maMode, ma3, Math.max(1, Math.floor(Math.sqrt(maLen))));
  const atr = calculateATR(data, atrPeriod);
  const vwap = calculateRollingVWAP(data, vwapPeriod);

  const signals = new Array(n).fill(null);
  const eventLabels = new Array(n).fill(null);
  const stopLossLevels = new Array(n).fill(null);
  const takeProfitLevels = new Array(n).fill(null);

  for (let i = 1; i < n; i++) {
    if (ma3[i] === null || ma4[i] === null || ma3[i - 1] === null || ma4[i - 1] === null ||
        atr[i] === null || vwap[i] === null) continue;

    const crossUp = ma3[i - 1] <= ma4[i - 1] && ma3[i] > ma4[i];
    const crossDown = ma3[i - 1] >= ma4[i - 1] && ma3[i] < ma4[i];
    if (!crossUp && !crossDown) continue;

    const close = data[i].close;
    // Only take the cross if it agrees with the VWAP trend gate — reject counter-trend crosses.
    if (crossUp && close <= vwap[i]) continue;
    if (crossDown && close >= vwap[i]) continue;

    const stopDist = atr[i] * atrMult;
    signals[i] = crossUp ? 'BUY' : 'SHORT';
    eventLabels[i] = crossUp ? 'ORACLE_CROSS_UP' : 'ORACLE_CROSS_DOWN';
    stopLossLevels[i] = crossUp ? close - stopDist : close + stopDist;
    takeProfitLevels[i] = crossUp ? close + stopDist * rrRatio : close - stopDist * rrRatio;
  }

  const backtest = runSimulator(data, signals, initialCapital, feePercent, stopLossLevels, takeProfitLevels, eventLabels);
  backtest.eventLabels = eventLabels;
  backtest.indicators = [
    { name: `VWAP (${vwapPeriod})`, type: 'line', data: vwap, color: '#00e5ff' },
    { name: 'Oracle ma3', type: 'line', data: ma3, color: '#2962ff' },
    { name: 'Oracle ma4', type: 'line', data: ma4, color: '#ff9800' }
  ];

  // Live signal state snapshot, same shape as the other strategies' currentState so
  // updateSignalPanel2 can render it directly.
  const last = n - 1;
  const openTrade = (() => {
    for (let i = backtest.trades.length - 1; i >= 0; i--) {
      const t = backtest.trades[i];
      if (t.type === 'BUY' || t.type === 'SHORT') return t;
      if (t.type === 'SELL' || t.type === 'COVER') return null;
    }
    return null;
  })();
  backtest.currentState = {
    price: data[last].close,
    vwap: vwap[last],
    aboveVwap: vwap[last] !== null ? data[last].close > vwap[last] : null,
    bullishStructure: (ma3[last] !== null && ma4[last] !== null) ? ma3[last] > ma4[last] : null,
    signal: signals[last],
    openTrade: openTrade ? {
      direction: openTrade.direction,
      entryPrice: openTrade.price,
      stopLoss: stopLossLevels[openTrade.index],
      takeProfit: takeProfitLevels[openTrade.index],
      unrealizedPct: openTrade.direction === 'LONG'
        ? (data[last].close - openTrade.price) / openTrade.price * 100
        : (openTrade.price - data[last].close) / openTrade.price * 100
    } : null
  };

  return backtest;
}
