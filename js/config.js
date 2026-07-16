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
// The previous 21/30/80/2.0/1.0 params were validated only against the live app window (~1000
// candles). Re-validating on FIVE non-overlapping 1000-candle windows (~2.3 years, 2024-04 to
// 2026-07) exposed that they actually lose in 2 of the 5 (-3.4%, -13.9% with 26.1% drawdown) —
// never caught because that methodology didn't exist yet when they were picked.
//
// Grid sweep across the same 5 windows (~639k combos total across a wide pass + two finer passes
// on the promising regions, requiring >=12 closed trades/window to keep the current trade
// frequency) found emaFast=24/emaSlow=30/vwapPeriod=105/atrMult=3.75/rrRatio=0.5: positive on ALL 5
// windows (avg return +20.4%/window, avg win rate 81.6%, avg drawdown 7.3%, worst window still
// +11.5% return / 73.3% win rate), a large improvement on every axis over the old params (+2.6%
// avg return, 56.1% avg win rate, 12.5% avg drawdown) at a similar trade frequency (14/window vs
// 18.6/window). Confirmed not a lucky point: stable across neighbors in emaFast (20-28), emaSlow
// (26-34), atrMult (3.25-4.25) and rrRatio (0.25-1.0) — the one sensitive dimension is vwapPeriod,
// which drops to only 3-4/5 profitable windows below 100 (105-120 is the safe range).
const STRATEGY2_PARAMS = {
  emaFast: 24, emaSlow: 30, vwapPeriod: 105, atrPeriod: 14, atrMult: 3.75, rrRatio: 0.5
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
