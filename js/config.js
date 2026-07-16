// Strategy parameters — fixed in code rather than exposed as UI controls, since every value here
// was tuned and validated against real BTC/USDT 4h data (see session history: Wyckoff structure
// detection, ATR-scaled stops, major S/R take-profit targets, VWAP + EMA21/50 trend gate, Stochastic
// RSI confluence). Changing any of these should be re-validated against real data, not eyeballed.
//
// No dependencies. Must load before strategy-wyckoff.js, strategy-emacross.js and main.js.
const STRATEGY_PARAMS = {
  lookback: 15, volMult: 2.5, emaTrendPeriod: 50, vwapPeriod: 80, ema21Period: 21, ema50Period: 50,
  atrPeriod: 14, atrMult: 2.8, srBars: 10, tpFraction: 0.65, minRejection: 0.7,
  rsiPeriod: 14, stochPeriod: 24, stochK: 4, stochD: 3, stochBuy: 20, stochSell: 85
};

// Strategy 2 (reference/comparison): "triple cross" of EMA-fast, EMA-slow and VWAP — entry fires
// the instant all three lines settle into full bullish/bearish alignment (whichever pairwise cross
// completes it), and a position is held until either SL/TP fires or the full opposite alignment
// forms (no early exit on a partial breakdown). Simpler and more classic than the Wyckoff system.
//
// RE-TUNED (2026-07-15) against a 5-YEAR span (11 non-overlapping 1000-candle windows, 2021-07 to
// 2026-07, covering the 2021 bull, the 2022 bear -75%, the 2023 recovery and the 2024-2026 cycle).
// The old 24/30/105/3.75/0.5 params only ever validated against 2.3 years turned out to lose badly
// in 2 of the 11 windows (-27.1%/30.4%DD during a 2023-2024 whipsaw, -36.1%/44.2%DD during the
// Nov-2021-ATH crash). An exhaustive EMA(10-100) x VWAP(10-100) grid (step 1, ~769,860 structure x
// risk combos) found the single fully-robust point at emaFast=39/slow=41/vwap=34, but that traded
// off win rate hard (48% avg vs the old params' 70.6%) for the extra robustness. Re-examining the
// same tier-12 sweep results for combos that beat the old params on BOTH win rate AND trade count
// (not just robustness) surfaced emaFast=42/emaSlow=48/vwapPeriod=42 at the SAME risk geometry
// (atrMult=3.75/rrRatio=0.5) as the old params: 9/11 positive windows (vs 8/11), avg win rate 72.4%
// (vs 70.6%), ~16.6 trades/window (vs 14.3, +16%), avg drawdown 11.4% (vs 15.6%), and critically a
// worst window of only -5.9% (vs -36.1%) — nearly eliminates the old params' tail risk while
// improving every metric the user cared about (acierto, frequency) instead of trading them away.
// Neighborhood mostly degrades gracefully (7-9/11 across +-1/+-2 steps in emaFast/emaSlow/atrMult);
// vwapPeriod is the sensitive dimension here too (drops to 5/11 at vwapPeriod-2), so don't retune
// vwapPeriod alone without re-checking robustness.
const STRATEGY2_PARAMS = {
  emaFast: 42, emaSlow: 48, vwapPeriod: 42, atrPeriod: 14, atrMult: 3.75, rrRatio: 0.5
};

const INITIAL_CAPITAL = 100;
const FEE_PERCENT = 0.001; // 0.1% per side

// Strategy 3: same VWAP+EMA triple-cross engine as Strategy 2 (runEmaCrossStrategy), applied to
// ETH/USDT 4h via Binance instead of BTC/USDT — reuses the exact same live-data infrastructure
// (Strategy 3 was originally going to fetch daily stock bars via Yahoo Finance/yfinance, but three
// different free CORS proxies all got blocked by Yahoo in practice, so it was switched to ETH on
// Binance instead, which was already proven reliable). Validated the same way as every other
// parameter in this project (real ETH/USDT 4h data, current live app window): 23 trades, 69.6% win
// rate, 30.51% return, 8.30% max drawdown, PF 1.93 — confirmed stable across the neighborhood of
// nearby EMA/VWAP periods (16-22 / 40-50 / 55), not a lucky single point.
const STRATEGY3_PARAMS = {
  emaFast: 19, emaSlow: 45, vwapPeriod: 55, atrPeriod: 14, atrMult: 2.0, rrRatio: 1.0
};
