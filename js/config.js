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
//
// Later refinement (same 5 windows, wider grid incl. atrMult up to 6.0 and rrRatio down to 0.25):
// atrMult 3.75 -> 4.5 and rrRatio 0.5 -> 0.4. A wider ATR stop with a nearer target survives more
// noise shakeouts and banks the move earlier, which trades a sliver of average return for a
// materially calmer equity curve: avg win rate 82.7% -> 84.3%, avg drawdown 7.30% -> 6.61%, and
// most importantly WORST-window drawdown 11.26% -> 7.65%, at identical trade frequency (14.0/window,
// 75 trades over the combined 2024-04..2026-07 span) and effectively identical combined return
// (+184.4% -> +185.1%, PF 3.09 -> 3.14). Still 5/5 windows positive, and still not a lucky point:
// stable across emaFast (20-28), emaSlow (26-34), atrMult (3.75-5.0) and rrRatio (0.25-0.6), with
// vwapPeriod=105 remaining the one sensitive dimension as before.
//
// This timeframe was also re-examined directly: dropping the strategy to 2h was swept from scratch
// (~45.6k combos over the same 5 windows) and is worse on every axis the 4h version is judged on —
// the 2h optima merely converge back to doubled periods (EMA ~48-52/60, VWAP 210) while running at
// the SAME ~14 trades/window, with a lower win-rate ceiling and roughly double the drawdown. Higher
// trade frequency is not reachable profitably at 2h: requiring >=25 trades/window left only 1 of
// 27.5k combos positive on all 5 windows (+6.8% avg, 47.5% win rate, 18.5% drawdown). Do not port
// this strategy to 2h.
const STRATEGY2_PARAMS = {
  emaFast: 24, emaSlow: 30, vwapPeriod: 105, atrPeriod: 14, atrMult: 4.5, rrRatio: 0.4
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

// Strategy 4: the same triple-cross engine as Strategy 2 (runEmaCrossStrategy) on BTC/USDT 2h.
// Strategy 2 is deliberately left untouched; this is a separate tab, not a replacement.
//
// The EMA pair is 12/60, NOT Strategy 2's 24/30. The tab originally shipped with 24/30 pinned, on the
// assumption that the strategy's identity was that pair. Freeing emaFast/emaSlow and sweeping
// 2,762,760 combinations (253 EMA pairs x 15 vwapPeriod x 8 atrMult x 7 rrRatio x 13 re-entry
// settings, plus ~218k more in three refinement passes) showed that assumption cost a lot: 24/30 is
// simply not the right pair for 2h. Everything below is measured on the project's 5 non-overlapping
// windows (2024-04..2026-07) by running the production runEmaCrossStrategy itself, never a
// reimplementation — the fast sweep engine was held to exact parity (1495/1495 window runs) first.
//
// Chosen over three rival configurations because it is the best *system*, not the highest number:
//   - 5/5 windows positive with win rate between 72.7% and 81.6% — no regime where it breaks down.
//   - Longest losing streak in 188 combined trades: 2. The alternatives reach 5 and 6.
//   - Break-even win rate is 68.8% (wins average +2.26%, losses -4.99%) against 76.1% delivered — a
//     7.2-point cushion, the widest of any high-win-rate candidate.
//   - Survives costs: still +79.5% combined at 0.20% fees/side and +33.9% at 0.30%, where the
//     previous 24/30 configuration turns negative (-6.0%).
//
// Per window: 35.0 trades (1.47/week), 77.1% win rate, +21.07% return, 15.6% avg drawdown, worst
// window +3.54% / 18.3% drawdown, PF 1.55. Combined 2024-04..2026-07: 188 trades, +140.5%, 18.8%
// drawdown, PF 1.38 (the previous 24/30 setup: +57.2%, 22.1% drawdown, PF 1.19). Average holding
// time 2.6 days. Neighborhood: 56% of adjacent points still hold 5/5, up from 46%.
//
// DO NOT nudge rrRatio, emaSlow or atrMult without re-running the 5-window validation — unlike the
// rest of this file, these three sit on a narrow ridge rather than a plateau. rrRatio 0.40 drops to
// 4/5 and 0.55 to 3/5; emaSlow 52 and 70 both drop to 3/5; atrMult 4.5 collapses to 2/5 (PF 1.07).
// vwapPeriod (200-240) and reentryCooldown (3-5) are the two forgiving dimensions.
//
// The trendFilter* fields add the one refinement that cost nothing: no new short while EMA(50) is
// still above where it sat 5 candles earlier. It came out of sweeping 4,567,500 combinations (145
// background-trend filters — price vs EMA, price vs VWAP, EMA slope and long EMA crosses, each
// gating longs, shorts or both — across 31,500 base configurations). Two results from that sweep
// are worth keeping in mind:
//   - No filter raises the trade count. Filtering can only remove entries, so this whole family is
//     a dead end for trade frequency; it was worth running only because it improves quality.
//   - The long/short asymmetry visible in a falling live window does NOT exist in the history:
//     across the 5 windows longs win 76.7% and shorts 78.0%. There was no long-entry defect to fix.
// Measured with this very function on the same 5 windows, against the identical configuration with
// the filter off: 35.0 -> 34.6 trades/window (1.47 -> 1.45/week, i.e. essentially free), win rate
// 77.1% -> 78.0%, return +21.07% -> +23.23%, average drawdown 15.59% -> 14.83%, worst window +3.54%
// -> +10.17%, worst drawdown unchanged at 18.35%, PF 1.55 -> 1.62, and neighborhood robustness
// 54% -> 73%. Combined 2024-04..2026-07: 188 -> 186 trades, +140.52% -> +164.28%, PF 1.38 -> 1.44.
// A flat plateau rather than a spike: filter periods 20, 30, 40 and 50 give identical results (60-100
// slightly worse but still 5/5), lookbacks 3, 5 and 8 all hold 5/5, and gating shorts beats gating
// longs (+18.4%) or both sides (+20.5%). Warm-up costs 54 of the app's 1000 candles.
//
// Two caveats to keep in view. First, the filter intervenes rarely — it changes only 2 of the 5
// windows (the first and the fourth) and removes just 2 trades out of 188 over the combined span, so
// the entire gain rests on avoiding a handful of bad shorts; that is a small sample however good the
// aggregate looks. Second, it was selected from 4,567,500 candidates, so some selection bias is
// unavoidable — the flat plateau and the *improved* robustness are the defence, not a substitute for
// genuine out-of-sample evidence. In the app's current live window it costs a little: 16 -> 14 trades
// and +11.86% -> +8.99%.
//
// IMPORTANT: 2h remains worse than 4h on risk (Strategy 2: 84.3% win rate, 6.6% drawdown, PF 4.41,
// +185% combined). This tab buys trade frequency; it is not an improvement on Strategy 2 and its
// numbers answer a different question.
const STRATEGY4_PARAMS = {
  emaFast: 12, emaSlow: 60, vwapPeriod: 220, atrPeriod: 14, atrMult: 5.5, rrRatio: 0.45,
  reentryCooldown: 4, maxReentries: 2,
  trendFilterPeriod: 50, trendFilterLookback: 5, trendFilterSide: 'short'
};
