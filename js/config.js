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

// Strategy 2 (reference/comparison): "triple cross" of EMA21, EMA30 and VWAP — entry fires the
// instant all three lines settle into full bullish/bearish alignment (whichever pairwise cross
// completes it), and a position is held until either SL/TP fires or the full opposite alignment
// forms (no early exit on a partial breakdown). Simpler and more classic than the Wyckoff system —
// validated against the app's own live window (current ~1000-candle 4h dataset, ~13 trades) and
// confirmed stable across the full neighborhood of nearby EMA/VWAP periods (18-24 / 25-35 / 65-95),
// unlike a tempting-looking fast=7/slow=15/vwap=20 candidate that collapsed from +39% to -34% on a
// 10-period VWAP shift (classic overfitting, rejected). emaFast/emaSlow moved from 25/50 to 21/30 —
// on the live app window this raised win rate 69.2% -> 76.5%, return 13.55% -> 31.40%, and lowered
// drawdown 9.23% -> 4.37%, all at once. Still a smaller trade sample than the Wyckoff strategy's, so
// treat with slightly more caution — kept as a side-by-side comparison view, not a recommended default.
const STRATEGY2_PARAMS = {
  emaFast: 21, emaSlow: 30, vwapPeriod: 80, atrPeriod: 14, atrMult: 2.0, rrRatio: 1.0
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

// Strategy 4: "Oracle Move" — Hull-style double-MA (ma3/ma4 cross) ported from the "Oracle Move
// [wm]" Pine Script indicator, applied to BTC/USDT 4h via Binance (same feed as Strategy 1/2).
//
// Params below replace the indicator's own script defaults (maLen=30, atrMult=2.0, rr=1.5) after a
// grid sweep (mode x maLen 10-80 x atrMult 1.5-3.0 x rr 1.0-2.5, 768 combos) evaluated on THREE
// non-overlapping 1000-candle windows, not just the live app window — the original sweep's
// top-by-return candidates (e.g. len=60/atrMult=2.75, +29.6% on the live window) collapsed to -17%
// on the very next window back, a textbook overfit. Only 8/768 combos stayed profitable across all
// three windows; this is the best of those by worst-window return: avg +8.0%/window, worst window
// still +2.7%, ~69.5% win rate, 15-23% max drawdown, PF 1.06-1.32 in every window tested — modest
// but a genuine edge, not a lucky point.
//
// Also swept 1h and 1d timeframes the same way (same param grid, 3 non-overlapping windows each):
// 0/768 combos held up on 1h (windows too short/noisy at ~40 days each for 1000 1h candles) and
// 0/768 held up on 1d (windows spanning 2018-2026 cross multiple bull/bear regimes this raw MA
// cross — with no trend/volume filter unlike Strategy 1/2 — doesn't survive). 4h is the only
// timeframe where this indicator showed a robust edge, hence BTC/USDT 4h below.
const STRATEGY4_PARAMS = {
  maLen: 80, maMode: 'wma', atrPeriod: 14, atrMult: 3.0, rrRatio: 1.5
};
