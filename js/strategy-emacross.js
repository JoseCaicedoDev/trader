// Strategy 2 (reference/comparison): "triple cross" of EMA-fast, EMA-slow and VWAP — no Wyckoff
// structure involved. A signal fires on the exact candle where the three lines newly settle into
// full bullish alignment (EMA-fast > EMA-slow and both above VWAP) or full bearish alignment
// (EMA-fast < EMA-slow and both below VWAP) — i.e. whichever of the three pairwise crosses
// (EMA-fast/EMA-slow, EMA-fast/VWAP, EMA-slow/VWAP) completes the alignment triggers the entry, not
// just the EMA-fast/EMA-slow cross alone. A position stays open until either SL/TP fires or the
// FULL opposite alignment forms (not just a partial breakdown of the current one) — validated on
// real BTC data to raise combined return substantially (23.8% -> 42.7%) while lowering drawdown
// (17.2% -> 9.2%), a stable improvement across a wide atrMult/rrRatio neighborhood, not a single
// lucky point. Stop is ATR-scaled from the entry candle; target is a fixed risk:reward multiple of
// the stop distance (no structural range to project from, unlike Wyckoff).
//
// Optional re-entry (params.reentryCooldown / params.maxReentries, both absent or 0 = disabled):
// once a stop or target closes a position, the account sits flat even when the alignment that
// produced the trade is still fully intact — the base engine only opens again when a brand-new
// alignment forms, which is what caps the trade count. With re-entry enabled, the strategy takes
// another position in the SAME alignment episode, `reentryCooldown` candles after the exit, up to
// `maxReentries` times per episode. Used only by Strategy 4 (BTC 2h); Strategies 2 and 3 omit both
// params and are therefore byte-identical to the pre-re-entry behavior.
//
// Depends on: indicators.js (calculateEMA, calculateRollingVWAP, calculateATR) and simulator.js
// (runSimulator). Must load after both.
function runEmaCrossStrategy(data, params, initialCapital, feePercent) {
  const { emaFast, emaSlow, vwapPeriod, atrPeriod, atrMult, rrRatio,
          reentryCooldown = 0, maxReentries = 0 } = params;
  const emaF = calculateEMA(data, emaFast);
  const emaS = calculateEMA(data, emaSlow);
  const vwap = calculateRollingVWAP(data, vwapPeriod);
  const atr = calculateATR(data, atrPeriod);

  const signals = new Array(data.length).fill(null);
  const entryLabels = new Array(data.length).fill(null);
  const stopLossLevels = new Array(data.length).fill(null);
  const takeProfitLevels = new Array(data.length).fill(null);

  // +1 = fully bullish aligned, -1 = fully bearish aligned, 0 = no alignment
  function alignment(i) {
    if (emaF[i] === null || emaS[i] === null || vwap[i] === null) return 0;
    if (emaF[i] > emaS[i] && emaF[i] > vwap[i] && emaS[i] > vwap[i]) return 1;
    if (emaF[i] < emaS[i] && emaF[i] < vwap[i] && emaS[i] < vwap[i]) return -1;
    return 0;
  }

  // Alignment state per candle plus an id for the uninterrupted run ("episode") it belongs to, so
  // the re-entry pass can tell "same trend as the trade that just closed" from "a new one formed".
  const align = new Array(data.length).fill(0);
  const episodeId = new Array(data.length).fill(0);
  for (let i = 0; i < data.length; i++) {
    align[i] = alignment(i);
    episodeId[i] = i === 0 ? 0 : episodeId[i - 1] + (align[i] !== align[i - 1] ? 1 : 0);
  }

  // Stop/target geometry is identical for both directions (ATR-scaled distance, mirrored above
  // vs below the entry close) — computed once and applied with the sign flipped per direction.
  function placeEntry(i, direction) {
    const close = data[i].close;
    const stopDist = atr[i] * atrMult;
    const isBullish = direction === 1;
    signals[i] = isBullish ? 'BUY' : 'SHORT';
    entryLabels[i] = isBullish ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN';
    stopLossLevels[i] = isBullish ? close - stopDist : close + stopDist;
    takeProfitLevels[i] = isBullish ? close + stopDist * rrRatio : close - stopDist * rrRatio;
  }

  for (let i = 1; i < data.length; i++) {
    if (atr[i] === null) continue;
    if (align[i] === align[i - 1] || (align[i] !== 1 && align[i] !== -1)) continue;
    placeEntry(i, align[i]);
    // No intermediate exit signal on a partial alignment breakdown — a position only closes via
    // SL/TP or a full opposite-direction entry (handled as a reversal by runSimulator), per the
    // validated "hold until opposite cross" behavior above.
  }

  // runSimulator writes exit labels into the array it is given, so each pass gets a fresh clone of
  // the entry labels and the re-entry pass reads the exits off the result of the previous run. This
  // keeps the stop/target fill rules and the P&L math in runSimulator alone instead of duplicating
  // them here (verified numerically identical to the reference sweep engine on 5 windows + combined).
  let eventLabels = entryLabels.slice();
  let backtest = runSimulator(data, signals, initialCapital, feePercent, stopLossLevels, takeProfitLevels, eventLabels);
  const reentriesByEpisode = new Map();
  for (let pass = 0; reentryCooldown > 0 && pass < maxReentries; pass++) {
    let added = false;
    for (const trade of backtest.trades) {
      if (trade.type !== 'SELL' && trade.type !== 'COVER') continue;
      const exitLabel = eventLabels[trade.index];
      if (exitLabel !== 'STOP_LOSS' && exitLabel !== 'TAKE_PROFIT') continue;
      // An exit landing on a candle that already carries an entry belongs to the previous episode
      // and was immediately followed by the flip's own entry — there is nothing to re-enter into.
      if (signals[trade.index] !== null) continue;

      const episode = episodeId[trade.index];
      const direction = align[trade.index];
      if (direction === 0 || (reentriesByEpisode.get(episode) || 0) >= maxReentries) continue;

      const j = trade.index + reentryCooldown;
      // The trend must still be the same uninterrupted run once the cooldown has elapsed; if it
      // broke down or reversed in between, the ordinary flip logic already handled it.
      if (j >= data.length || episodeId[j] !== episode || signals[j] !== null || atr[j] === null) continue;

      placeEntry(j, direction);
      reentriesByEpisode.set(episode, (reentriesByEpisode.get(episode) || 0) + 1);
      added = true;
    }
    if (!added) break;
    eventLabels = entryLabels.slice();
    backtest = runSimulator(data, signals, initialCapital, feePercent, stopLossLevels, takeProfitLevels, eventLabels);
  }
  backtest.eventLabels = eventLabels;
  backtest.indicators = [
    { name: `VWAP (${vwapPeriod})`, type: 'line', data: vwap, color: '#00e5ff' },
    { name: `EMA${emaFast}`, type: 'line', data: emaF, color: '#ffca28' },
    { name: `EMA${emaSlow}`, type: 'line', data: emaS, color: '#ff7043' }
  ];

  // Live signal state snapshot, same shape as the Wyckoff strategy's currentState (minus the
  // Stochastic/event fields that don't apply here) so updateSignalPanel2 can render it directly.
  const last = data.length - 1;
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
    bullishStructure: (emaF[last] !== null && emaS[last] !== null) ? emaF[last] > emaS[last] : null,
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
