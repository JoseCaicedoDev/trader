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
// Optional background-trend filter (params.trendFilterPeriod / trendFilterLookback /
// trendFilterSide, filter off when the period is absent or 0): gates which SIDE may open a
// position, based on the slope of a longer EMA — bullish when EMA(period) sits above where it was
// `lookback` candles ago. `trendFilterSide` is 'long', 'short' or 'both' and names the side being
// gated: 'short' blocks new shorts while that longer EMA is still rising, which is the only
// configuration currently in use (Strategy 4). Candles where the filter cannot be evaluated yet
// count as blocking — a filter you cannot read is not a filter you may ignore.
//
// Depends on: indicators.js (calculateEMA, calculateRollingVWAP, calculateATR) and simulator.js
// (runSimulator). Must load after both.
function runEmaCrossStrategy(data, params, initialCapital, feePercent) {
  const { emaFast, emaSlow, vwapPeriod, atrPeriod, atrMult, rrRatio,
          reentryCooldown = 0, maxReentries = 0,
          trendFilterPeriod = 0, trendFilterLookback = 0, trendFilterSide = null,
          counterOnTP = false, counterAtrMult = null, counterRrRatio = null,
          counterOnlyAfter = null } = params;
  const emaF = calculateEMA(data, emaFast);
  const emaS = calculateEMA(data, emaSlow);
  const vwap = calculateRollingVWAP(data, vwapPeriod);
  const atr = calculateATR(data, atrPeriod);

  const filterActive = trendFilterPeriod > 0 && trendFilterLookback > 0 && trendFilterSide !== null;
  const trendEma = filterActive ? calculateEMA(data, trendFilterPeriod) : null;
  // +1 rising, -1 falling, 0 not yet computable (treated as blocking for the gated side)
  function backgroundTrend(i) {
    const j = i - trendFilterLookback;
    if (j < 0 || trendEma[i] === null || trendEma[j] === null) return 0;
    return trendEma[i] > trendEma[j] ? 1 : -1;
  }
  function entryAllowed(i, direction) {
    if (!filterActive) return true;
    const gated = trendFilterSide === 'both'
      || (direction === 1 ? trendFilterSide === 'long' : trendFilterSide === 'short');
    if (!gated) return true;
    return backgroundTrend(i) === direction;
  }

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
    if (entryAllowed(i, align[i])) {
      placeEntry(i, align[i]);
    } else {
      // The trend turned against any position held in the opposite direction, so it still has to
      // close even though the filter forbids opening the new one. EXIT_*_MOMENTUM closes only its
      // own direction and never reverses, which is exactly that: exit without entry.
      signals[i] = align[i] === 1 ? 'EXIT_SHORT_MOMENTUM' : 'EXIT_LONG_MOMENTUM';
    }
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
      // The filter gates re-entries exactly as it gates first entries; no exit signal is needed here
      // because a re-entry point is flat by definition.
      if (!entryAllowed(j, direction)) continue;

      placeEntry(j, direction);
      reentriesByEpisode.set(episode, (reentriesByEpisode.get(episode) || 0) + 1);
      added = true;
    }
    if (!added) break;
    eventLabels = entryLabels.slice();
    backtest = runSimulator(data, signals, initialCapital, feePercent, stopLossLevels, takeProfitLevels, eventLabels);
  }
  // Counter book (params.counterOnTP): a SECOND, independent position that opens in the opposite
  // direction on the exact candle where the strategy closes a trade at its target, and exits only
  // through its own stop or target — so at most two positions are ever live at once, one from the
  // strategy and one from the counter (e.g. a short from a take-profit running alongside a long from
  // the strategy). Capital is split evenly between the two, which is what "two simultaneous
  // positions" means when there is no leverage: each book trades half the account.
  if (counterOnTP) {
    const counter = runCounterBook(data, backtest, eventLabels, atr, {
      atrMult: counterAtrMult === null ? atrMult : counterAtrMult,
      rrRatio: counterRrRatio === null ? rrRatio : counterRrRatio,
      onlyAfter: counterOnlyAfter
    }, initialCapital, feePercent);
    backtest = mergeBooks(backtest, counter, initialCapital);
  }

  // Tag entries with their own label. The per-candle array cannot carry both: when a stop and the
  // reversal it triggers land on the same candle, runSimulator overwrites that slot with the exit
  // reason, and the entry would otherwise be displayed as "Stop Loss".
  for (const trade of backtest.trades) {
    if ((trade.type === 'BUY' || trade.type === 'SHORT') && !trade.eventCode && entryLabels[trade.index]) {
      trade.eventCode = entryLabels[trade.index];
    }
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

// Counter book simulation. Deliberately NOT runSimulator: this book must SKIP a trigger that lands
// while it already holds a position, whereas runSimulator would treat an opposite signal as a
// reversal. Everything else (intrabar stop-before-target, fee model, cash-settled sizing) mirrors it.
// `strategyBacktest`/`exitLabels` supply the trigger candles — the ones where the strategy closed at
// its target. A counter trade closing at its own target never triggers another one: no chaining.
function runCounterBook(data, strategyBacktest, exitLabels, atr, cfg, initialCapital, feePercent) {
  const triggers = new Map();
  for (const trade of strategyBacktest.trades) {
    if (trade.type !== 'SELL' && trade.type !== 'COVER') continue;
    if (exitLabels[trade.index] !== 'TAKE_PROFIT') continue;
    if (cfg.onlyAfter && trade.direction !== cfg.onlyAfter) continue;
    triggers.set(trade.index, trade.direction === 'LONG' ? -1 : 1);
  }

  let cash = initialCapital, direction = 0, units = 0, entryPrice = 0, entryCost = 0, entryTime = null;
  let stop = 0, target = 0, peak = initialCapital, maxDd = 0;
  const trades = [], equityCurve = [];

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];

    if (direction !== 0) {
      const hitStop = direction === 1 ? candle.low <= stop : candle.high >= stop;
      const hitTarget = direction === 1 ? candle.high >= target : candle.low <= target;
      if (hitStop || hitTarget) {
        const exitPrice = hitStop ? stop : target;
        let pnl, net;
        if (direction === 1) {
          const gross = units * exitPrice;
          net = gross - gross * feePercent;
          pnl = net - entryCost;
        } else {
          const grossPnl = units * (entryPrice - exitPrice);
          net = entryCost + grossPnl - units * exitPrice * feePercent;
          pnl = net - entryCost;
        }
        cash = net;
        trades.push({
          index: i, type: direction === 1 ? 'SELL' : 'COVER', direction: direction === 1 ? 'LONG' : 'SHORT',
          time: candle.time, price: exitPrice, fee: units * exitPrice * feePercent, size: units,
          cashRemaining: cash, pnl, pnlPercent: (pnl / entryCost) * 100, equity: cash,
          holdTime: candle.time - entryTime, book: 'counter',
          eventCode: hitStop ? 'STOP_LOSS' : 'TAKE_PROFIT'
        });
        direction = 0; units = 0; entryPrice = 0; entryCost = 0; entryTime = null;
      }
    }

    const trigger = triggers.get(i);
    if (trigger !== undefined && direction === 0 && atr[i] !== null) {
      const stopDist = atr[i] * cfg.atrMult;
      units = cash * (1 - feePercent) / candle.close;
      entryPrice = candle.close; entryCost = cash; entryTime = candle.time; direction = trigger;
      stop = trigger === 1 ? entryPrice - stopDist : entryPrice + stopDist;
      target = trigger === 1 ? entryPrice + stopDist * cfg.rrRatio : entryPrice - stopDist * cfg.rrRatio;
      trades.push({
        index: i, type: trigger === 1 ? 'BUY' : 'SHORT', direction: trigger === 1 ? 'LONG' : 'SHORT',
        time: candle.time, price: candle.close, fee: cash * feePercent, size: units,
        cashRemaining: 0, pnl: 0, pnlPercent: 0, equity: cash, book: 'counter',
        eventCode: 'COUNTER_ON_TP'
      });
      cash = 0;
    }

    let equity = cash;
    if (direction === 1) equity += units * candle.close;
    else if (direction === -1) equity += entryCost + units * (entryPrice - candle.close);
    equityCurve.push({ time: candle.time, value: equity });
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  let finalBalance = cash;
  const lastClose = data[data.length - 1].close;
  if (direction === 1) finalBalance = cash + units * lastClose * (1 - feePercent);
  else if (direction === -1) finalBalance = cash + entryCost + units * (entryPrice - lastClose) - units * lastClose * feePercent;

  return { trades, equityCurve, finalBalance, maxDrawdown: maxDd * 100, triggerCount: triggers.size };
}

// Portfolio view of the two books: half the account each, so the reported equity curve, balance and
// drawdown are those of the account as a whole rather than of either book alone.
function mergeBooks(strategy, counter, initialCapital) {
  const half = 0.5;
  const equityCurve = strategy.equityCurve.map((point, i) => ({
    time: point.time,
    value: half * point.value + half * counter.equityCurve[i].value
  }));

  let peak = initialCapital, maxDd = 0;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const dd = (peak - point.value) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  // Each trade's `equity` is its own book's balance on a 100 base, which would read as a wildly
  // jumping account balance once the two books are interleaved. `accountEquity` is the balance of
  // the whole account at that candle, which is what the history table should show.
  const trades = strategy.trades
    .map(t => ({ ...t, book: t.book || 'strategy' }))
    .concat(counter.trades)
    .map(t => ({ ...t, accountEquity: equityCurve[t.index].value }))
    // Same candle: the strategy's own trades must keep their original relative order (an exit and
    // the reversal that opens right after it share an index), so only order ACROSS books here.
    .sort((a, b) => a.index - b.index
      || (a.book === b.book ? 0 : a.book === 'strategy' ? -1 : 1));

  let grossProfits = 0, grossLosses = 0;
  for (const t of trades) {
    if (t.type !== 'SELL' && t.type !== 'COVER') continue;
    if (t.pnl > 0) grossProfits += t.pnl; else grossLosses += Math.abs(t.pnl);
  }

  return {
    ...strategy,
    trades,
    equityCurve,
    finalBalance: half * strategy.finalBalance + half * counter.finalBalance,
    maxDrawdown: maxDd * 100,
    profitFactor: grossLosses === 0 ? (grossProfits > 0 ? Infinity : 1) : grossProfits / grossLosses,
    totalTrades: trades.filter(t => t.type === 'SELL' || t.type === 'COVER').length,
    books: { strategy, counter }
  };
}
