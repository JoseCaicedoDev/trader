// Indicator Calculation Library — pure functions over candle arrays, no DOM/chart dependencies.
// No dependencies on other files. Must load before strategy-wyckoff.js and strategy-emacross.js.

// Average True Range (Wilder smoothing): measures typical candle volatility, used to size the
// stop-loss distance to actual market conditions instead of a fixed percentage.
function calculateATR(data, period) {
  const n = data.length;
  const tr = new Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    const c = data[i], p = data[i - 1];
    tr[i] = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));
  }
  const atr = new Array(n).fill(null);
  if (period >= n) return atr;
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  atr[period] = sum / period;
  for (let i = period + 1; i < n; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

// Rolling VWAP: crypto trades 24/7 with no session close, so there's no clean daily reset like
// traditional VWAP — a rolling window over the typical price (H+L+C)/3 weighted by volume is the
// standard adaptation. Used as the primary trend gate (price above/below its own volume-weighted
// value area), validated on real BTC data to raise win rate and profit factor substantially over
// a plain EMA trend filter.
function calculateRollingVWAP(data, period) {
  const n = data.length;
  const vwap = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sumPV = 0, sumV = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const tp = (data[j].high + data[j].low + data[j].close) / 3;
      sumPV += tp * data[j].volume;
      sumV += data[j].volume;
    }
    vwap[i] = sumV > 0 ? sumPV / sumV : null;
  }
  return vwap;
}

// Major Support/Resistance via confirmed swing pivots: a candle is a pivot low/high only if it is
// the lowest/highest point within `bars` candles on both sides. A pivot at index p can only be
// "known" once `bars` candles have passed after it (confirmedAt = p + bars), so lookahead bias is
// avoided — at simulation time i, only pivots with confirmedAt <= i are usable. These longer-horizon,
// multi-candle-tested levels are more reliable turning points than the local rolling range alone
// (validated on real BTC data: using the nearest major level as the take-profit target, instead of
// only the local range projection, raises the win/loss ratio, profit factor and lowers drawdown).
// Returns pivots sorted by confirmedAt (ascending, since confirmedAt = p + bars is monotonic with
// p). The caller walks these with two pointers alongside its own forward loop over the candles to
// build the "known so far" level set at each index, without ever looking ahead.
function detectSwingLevels(data, bars) {
  const n = data.length;
  const pivotLows = [], pivotHighs = [];
  for (let p = bars; p < n - bars; p++) {
    let isLow = true, isHigh = true;
    for (let j = p - bars; j <= p + bars; j++) {
      if (j === p) continue;
      if (data[j].low <= data[p].low) isLow = false;
      if (data[j].high >= data[p].high) isHigh = false;
    }
    const confirmedAt = p + bars;
    if (isLow) pivotLows.push({ price: data[p].low, confirmedAt });
    if (isHigh) pivotHighs.push({ price: data[p].high, confirmedAt });
  }
  return { pivotLows, pivotHighs };
}

function nearestLevelBelow(levels, price) {
  let best = null;
  for (const l of levels) if (l <= price && (best === null || l > best)) best = l;
  return best;
}
function nearestLevelAbove(levels, price) {
  let best = null;
  for (const l of levels) if (l >= price && (best === null || l < best)) best = l;
  return best;
}

function calculateEMA(data, period) {
  let ema = new Array(data.length).fill(null);
  if (data.length < period) return ema;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  ema[period - 1] = sum / period;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i].close - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

function calculateRSI(data, period) {
  let rsi = new Array(data.length).fill(null);
  if (data.length <= period) return rsi;

  let gains = new Array(data.length).fill(0);
  let losses = new Array(data.length).fill(0);

  for (let i = 1; i < data.length; i++) {
    let diff = data[i].close - data[i - 1].close;
    if (diff > 0) {
      gains[i] = diff;
    } else {
      losses[i] = -diff;
    }
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));
  }

  for (let i = period + 1; i < data.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
    }
  }
  return rsi;
}

// Stochastic RSI: applies the Stochastic oscillator formula to the RSI series itself
// (RSI's position within its own high/low range over stochPeriod), then smooths the
// result into %K and %D lines the same way a classic Stochastic oscillator does.
function calculateStochasticRSI(data, rsiPeriod, stochPeriod, kSmooth, dSmooth) {
  const rsi = calculateRSI(data, rsiPeriod);
  const n = data.length;
  const rawStoch = new Array(n).fill(null);

  for (let i = stochPeriod - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity, valid = true;
    for (let j = i - stochPeriod + 1; j <= i; j++) {
      if (rsi[j] === null) { valid = false; break; }
      if (rsi[j] > hh) hh = rsi[j];
      if (rsi[j] < ll) ll = rsi[j];
    }
    if (!valid) continue;
    rawStoch[i] = hh === ll ? 0 : ((rsi[i] - ll) / (hh - ll)) * 100;
  }

  const k = smoothSMAOfArray(rawStoch, kSmooth);
  const d = smoothSMAOfArray(k, dSmooth);
  return { k, d };
}

function smoothSMAOfArray(arr, period) {
  const n = arr.length;
  const out = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    let sum = 0, valid = true;
    for (let j = i - period + 1; j <= i; j++) {
      if (arr[j] === null) { valid = false; break; }
      sum += arr[j];
    }
    if (valid) out[i] = sum / period;
  }
  return out;
}
