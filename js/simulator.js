// General Backtest Simulator Engine — Long & Short (simplified cash-settled futures model)
//
// Direction-agnostic: a position is either LONG or SHORT, sized against the full account equity
// (no leverage/margin multiplier, no funding rate, no liquidation modeling — this approximates a
// 1x futures position settled in cash, not a full margin/liquidation engine). SHORT P&L is the
// mirror of LONG: profit when price falls, loss when it rises.
//
// Supports optional per-entry Stop Loss / Take Profit levels (stopLossLevels/takeProfitLevels,
// indexed like `signals`), direction-aware: a LONG stop triggers on candle.low, a SHORT stop
// triggers on candle.high (mirrored). Once a position fills, every subsequent candle is checked
// for an intrabar stop or target hit *before* any new signal is processed, since price can
// invalidate or achieve the trade's plan well before the next opposing signal appears. If both
// the stop and the target fall within the same candle's range, the stop is assumed to trigger
// first (conservative assumption, since we can't know the intrabar path from OHLC alone).
//
// Signals: 'BUY' opens LONG (closing a SHORT first if one is open — a reversal); 'SHORT' opens
// SHORT (closing a LONG first if one is open); 'EXIT_LONG_MOMENTUM' / 'EXIT_SHORT_MOMENTUM' close
// their respective direction only, with no reversal (used for the momentum safety-net exit).
//
// No dependencies. Must load before strategy-wyckoff.js and strategy-emacross.js.
function runSimulator(data, signals, initialCapital, feePercent, stopLossLevels, takeProfitLevels, eventLabels) {
  let cash = initialCapital;
  let direction = null; // 'LONG' | 'SHORT' | null
  let units = 0;
  let entryPrice = 0;
  let entryCost = 0;
  let entryTime = null;
  let activeStop = null;
  let activeTarget = null;
  const trades = [];
  const equityCurve = [];
  let peak = initialCapital;
  let maxDd = 0;

  function closePosition(i, exitPrice, reasonLabel) {
    const candle = data[i];
    let pnl, net;
    if (direction === 'LONG') {
      const gross = units * exitPrice;
      const fee = gross * feePercent;
      net = gross - fee;
      pnl = net - entryCost;
    } else {
      const grossPnl = units * (entryPrice - exitPrice);
      const fee = units * exitPrice * feePercent;
      net = entryCost + grossPnl - fee;
      pnl = grossPnl - fee;
    }
    const pnlPercent = (pnl / entryCost) * 100;
    cash = net;

    trades.push({
      index: i,
      type: direction === 'LONG' ? 'SELL' : 'COVER',
      direction,
      time: candle.time,
      price: exitPrice,
      fee: units * exitPrice * feePercent,
      size: units,
      cashRemaining: cash,
      pnl: pnl,
      pnlPercent: pnlPercent,
      equity: cash,
      holdTime: candle.time - entryTime
    });
    if (eventLabels && reasonLabel) eventLabels[i] = reasonLabel;

    direction = null;
    units = 0;
    entryPrice = 0;
    entryCost = 0;
    entryTime = null;
    activeStop = null;
    activeTarget = null;
  }

  function openPosition(i, dir) {
    const candle = data[i];
    const costBasis = cash * (1 - feePercent);
    units = costBasis / candle.close;
    entryPrice = candle.close;
    entryCost = cash;
    entryTime = candle.time;
    direction = dir;
    activeStop = stopLossLevels ? stopLossLevels[i] : null;
    activeTarget = takeProfitLevels ? takeProfitLevels[i] : null;

    trades.push({
      index: i,
      type: dir === 'LONG' ? 'BUY' : 'SHORT',
      direction: dir,
      time: candle.time,
      price: candle.close,
      fee: cash * feePercent,
      size: units,
      cashRemaining: 0,
      pnl: 0,
      pnlPercent: 0,
      equity: cash
    });
    cash = 0;
  }

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const signal = signals[i]; // 'BUY', 'SELL', 'SHORT', 'COVER', 'EXIT_LONG_MOMENTUM', 'EXIT_SHORT_MOMENTUM', or null

    // Intrabar stop-loss / take-profit check for positions opened on a previous candle.
    if (direction === 'LONG' && (activeStop !== null || activeTarget !== null)) {
      if (activeStop !== null && candle.low <= activeStop) {
        closePosition(i, activeStop, 'STOP_LOSS');
      } else if (activeTarget !== null && candle.high >= activeTarget) {
        closePosition(i, activeTarget, 'TAKE_PROFIT');
      }
    } else if (direction === 'SHORT' && (activeStop !== null || activeTarget !== null)) {
      if (activeStop !== null && candle.high >= activeStop) {
        closePosition(i, activeStop, 'STOP_LOSS');
      } else if (activeTarget !== null && candle.low <= activeTarget) {
        closePosition(i, activeTarget, 'TAKE_PROFIT');
      }
    }

    if (signal === 'BUY') {
      if (direction === 'SHORT') closePosition(i, candle.close, null);
      if (direction === null) openPosition(i, 'LONG');
    } else if (signal === 'SHORT') {
      if (direction === 'LONG') closePosition(i, candle.close, null);
      if (direction === null) openPosition(i, 'SHORT');
    } else if (signal === 'EXIT_LONG_MOMENTUM' && direction === 'LONG') {
      closePosition(i, candle.close, null);
    } else if (signal === 'EXIT_SHORT_MOMENTUM' && direction === 'SHORT') {
      closePosition(i, candle.close, null);
    }

    // Calculate current equity at the end of the candle
    let currentEquity = cash;
    if (direction === 'LONG') currentEquity += units * candle.close;
    else if (direction === 'SHORT') currentEquity += entryCost + units * (entryPrice - candle.close);
    equityCurve.push({
      time: candle.time,
      value: currentEquity
    });

    // Drawdown Calculation
    if (currentEquity > peak) {
      peak = currentEquity;
    }
    const drawdown = (peak - currentEquity) / peak;
    if (drawdown > maxDd) {
      maxDd = drawdown;
    }
  }

  // Clean up metrics: if we hold a position at end of backtest, perform a simulated exit to view net asset balance
  let finalBalance = cash;
  const lastClose = data[data.length - 1].close;
  if (direction === 'LONG') {
    finalBalance = cash + units * lastClose * (1 - feePercent);
  } else if (direction === 'SHORT') {
    const grossPnl = units * (entryPrice - lastClose);
    const fee = units * lastClose * feePercent;
    finalBalance = cash + entryCost + grossPnl - fee;
  }

  // Calculate Profit Factor
  let grossProfits = 0;
  let grossLosses = 0;
  trades.forEach(t => {
    if (t.type === 'SELL' || t.type === 'COVER') {
      if (t.pnl > 0) grossProfits += t.pnl;
      else grossLosses += Math.abs(t.pnl);
    }
  });
  const profitFactor = grossLosses === 0 ? (grossProfits > 0 ? Infinity : 1) : (grossProfits / grossLosses);

  return {
    trades,
    equityCurve,
    finalBalance,
    maxDrawdown: maxDd * 100, // percentage
    profitFactor,
    totalTrades: trades.filter(t => t.type === 'SELL' || t.type === 'COVER').length // completed roundtrips
  };
}
