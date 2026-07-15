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
// IMPORTANT: an earlier version of runOracleMoveStrategy had the cross direction inverted (fired
// LONG when the slow line crossed above the fast line, which is the bearish case — caught from a
// live chart screenshot showing a LONG fired right as price rolled over into a fall). That bug is
// what produced an earlier "validated" param set (len=80/wma/atrMult=3/rr=1.5, ~70% win rate) that
// looked robust across 3 windows; re-run with the corrected direction, that same combo loses in 3
// of 5 windows (-26%, -15%, -23%). All tuning below is post-fix.
//
// First grid (mode x maLen 10-100 x atrMult 1.5-4.0 x rr 1.0-3.0, 7590 combos) evaluated on FIVE
// non-overlapping 1000-candle windows (~2.3 years, 2024-04 to 2026-07) with the raw ma3/ma4 cross
// and no other filter: zero combos positive on all 5 windows, win rate topped out ~40-41% (well
// below Strategy 1/2's 60-75%) — a raw crossover with no trend/volume confluence has its edge in
// average win size beating average loss size, not in a high hit rate, and one window (2024-09 to
// 2025-03) was bad for nearly every parameterization (190/7590 combos profited in it at all).
//
// Adding a VWAP trend gate — same rolling-VWAP filter as strategy-emacross.js, only take the cross
// if price is on the matching side of VWAP, rejecting counter-trend crosses — fixed exactly that:
// re-swept the same 5 windows with vwapPeriod added to the grid (5520 combos) and 63 combos are now
// positive on ALL 5 windows (vs. 0 without the filter). A finer follow-up sweep (maLen 50-100 step
// 2 x atrMult 1.5-2.5 step 0.25 x rr 1.0-1.5 x vwapPeriod 70-140 step 10, 9360 combos; 90 of them
// 5/5-positive) mapped the full plateau: alma / maLen 80-86 / atrMult=2.0 / rr=1 / vwapPeriod
// 100-120, with atrMult 1.75 and 2.25 both dropping to 3-4/5 positive on its edges (so not a lucky
// single point). len=80/vwap=120 is the best point in it — avg win rate 60.0% (worst window 55.0%),
// avg drawdown 10.9% (worst window 14.3%), avg return +8.9%/window, and every one of the 5
// non-overlapping windows individually profitable (worst window +1.3%). Chosen over the marginally
// lower-avg-drawdown len=82/vwap=100 (10.4% but worst-window DD 15.5%, worst-window win rate 50.0%)
// because it dominates on worst-case metrics, which is what robustness here is about.
const STRATEGY4_PARAMS = {
  maLen: 80, maMode: 'alma', atrPeriod: 14, atrMult: 2.0, rrRatio: 1.0, vwapPeriod: 120
};
