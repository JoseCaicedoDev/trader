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
// RE-TUNED (2026-07-15) on a 5-YEAR span: the previous 24/30/105/3.75/0.5 params (validated only
// against 5 non-overlapping windows / ~2.3 years, 2024-04 to 2026-07) were re-tested against 11
// non-overlapping 1000-candle windows spanning 2021-07 to 2026-07 (the 2021 bull, the 2022 bear
// -75%, the 2023 recovery, and the 2024-2026 cycle) and turned out to lose badly in 2 of the 11
// windows (-27.1% with 30.4% drawdown during a 2023-2024 bull whipsaw; -36.1% with 44.2% drawdown
// during the Nov-2021-ATH crash) — a real tail-risk failure mode invisible at the shorter span.
//
// An exhaustive grid over EVERY emaFast/emaSlow/vwapPeriod combination from 10 to 100 (step 1) plus
// a risk grid (~769,860 structure x risk combos, ~8.5M backtests across the 11 windows) found
// exactly ONE structure positive in all 11 windows: emaFast=39/emaSlow=41/vwapPeriod=34. Fine-tuning
// the risk pair around that structure landed on atrMult=2.25/rrRatio=1.5: positive on ALL 11 windows
// (avg return +14.4%/window, worst window still +3.7%, avg drawdown 13.3%, ~17.8 trades/window vs
// ~14.3 for the old params, avg win rate 48.0% — lower per-trade hit rate than the old params'
// 70.6%, but the old params' win rate came with a severe tail (worst window -36.1%/44.2% DD) that
// this structure eliminates entirely). Confirmed not a lucky point: degrades gracefully across a
// +-1/+-2 step neighborhood in every parameter, not a spike.
//
// Full report (asset ATR/regime profile, risk map, structure-robustness tables, alternate
// candidates B/C, high-frequency tier findings): see session history 2026-07-15. Notably, pushing
// trade frequency to >=25/window (2x) was explicitly explored and found NOT achievable without
// destroying 11-window robustness — every high-frequency structure tested collapses to <=8/11
// windows positive with win rate 40-60% and worst-window losses of -38% to -49%.
const STRATEGY2_PARAMS = {
  emaFast: 39, emaSlow: 41, vwapPeriod: 34, atrPeriod: 14, atrMult: 2.25, rrRatio: 1.5
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
