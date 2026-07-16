# LLM Wiki Schema & Agent Instructions

This workspace contains a personal knowledge base (LLM Wiki) dedicated to trading strategies, quantitative analysis, and backtesting experiments focused primarily on **BTC/USDT (Bitcoin)**, with one documented exception: Strategy 3 in the live app runs the same EMA-cross engine on **ETH/USDT** (see "Critical Technical Constraints" below for why). Wiki analysis pages should stay BTC-focused unless explicitly comparing against or extending to ETH.

As the AI agent in this workspace, you are the **Wiki Maintainer**. You must follow the instructions below to ensure that the wiki remains organized, consistent, and compounding over time.

---

## Directory Structure

All wiki files are located in the workspace folder `wiki/`:
- `wiki/` — The compiled, LLM-generated markdown files representing entity pages, concepts, strategies, and performance summaries.
- `wiki/sources/` — Immutable source materials (clipped web pages, text drafts, screenshots, strategy guidelines) dropped by the user.
- `wiki/index.md` — The central table of contents (index) for navigation.
- `wiki/log.md` — Chronological ledger of all actions performed (ingests, lint checks, test runs).

The live backtesting application lives in the root workspace. **This reflects the ACTUAL current file layout** (see the "Clean Code & Architecture Standards" section below for the historical target-architecture plan and which parts of it actually landed):
- `index.html` — Single-page app entry point (Antigravity Backtester | Estrategia Unificada Wyckoff BTC/USDT). Loads all scripts as classic `<script>` tags (no bundler) in dependency order; also contains the single reusable `<template id="strategy-view-template">` cloned once per strategy tab.
- `js/config.js` — All strategy parameters for all 3 strategies (`STRATEGY_PARAMS`, `STRATEGY2_PARAMS`, `STRATEGY3_PARAMS`) + `INITIAL_CAPITAL`/`FEE_PERCENT`. Do NOT change without re-validating on real data.
- `js/indicators.js` — Pure indicator library: ATR, Rolling VWAP, EMA, RSI, Stochastic RSI, Swing Levels (`detectSwingLevels`, no-lookahead pivot detection).
- `js/simulator.js` — General backtest engine (`runSimulator`): Long & Short, cash-settled 1x futures model.
- `js/strategy-wyckoff.js` — **Strategy 1**: Wyckoff Unificada (`runWyckoffUnifiedStrategy`, main strategy, recommended default).
- `js/strategy-emacross.js` — **Strategy 2 & 3 engine**: VWAP + EMA Triple Cross (`runEmaCrossStrategy`), shared by both the BTC (Strategy 2) and ETH (Strategy 3) tabs — same function, different `params`/`symbol`.
- `js/binance-api.js` — Binance REST wrapper (`fetchBinanceKlines`, CORS-safe via direct API calls, no proxy/key needed).
- `js/live-feed.js` — `LiveFeed` class (extends `EventTarget`): WebSocket wrapper for the live last-candle update, symbol/interval-parameterized, emits `'open'|'price'|'candleClose'|'close'|'error'`.
- `js/alerts.js` — Alert/notification manager: synthesized Web Audio beeps (ascending for BUY, descending for SHORT), native HTML5 Desktop Notifications, and animated toast fallback. Deduplicates per `symbol_strategy_timestamp_signal` key. Exposes `checkAndTriggerAlert()` / `initAlertManager()` to `live-feed.js`/`main.js`.
- `js/ui/dom-utils.js` — `CSS_CLASSES` (frozen token object), `EVENT_LABELS`, `formatDate()`, `formatPrice()`.
- `js/ui/metrics-panel.js` — `MetricsPanel` class: Return/WinRate/Trades/Drawdown/ProfitFactor cards, one instance per strategy view.
- `js/ui/signal-panel.js` — `SignalPanel` class: live signal checklist (VWAP/EMA/Stochastic/Position), shared shape for Wyckoff and EMA Cross states.
- `js/ui/trades-table.js` — `TradesTable` class: trade history table rendering via `DocumentFragment`.
- `js/ui/strategy-view.js` — `StrategyView` class: sub-tab switching (Chart/Equity/Trades) + top-level strategy switcher (static methods).
- `js/chart/chart-manager.js` — `ChartManager` class: generic LightweightCharts wrapper (price + equity charts), one instance per strategy view.
- `js/app/main.js` — App bootstrap (`STRATEGIES_CONFIG` array driving all 3 tabs), backtest orchestration (`runBacktestFlow`), live feed wiring (`setupLiveFeed`).

> Note: `config.js`, `indicators.js`, `simulator.js`, `strategy-wyckoff.js`, `strategy-emacross.js`, `binance-api.js`, `live-feed.js` and `alerts.js` all live at `js/` root, **not** under a `js/core/` or `js/data/` folder — the layered directory names in the "Target Architecture" diagram further below describe an aspirational plan for the Core/Infrastructure layers that was never executed (only the UI/Chart/App layers were actually extracted into subfolders). Don't assume `js/core/*.js` paths exist.

---

## Naming & Formatting Conventions

1. **Snake Case Filenames**: All markdown files in `wiki/` must use lower snake case (e.g., `rsi_reversion_media.md`).
2. **Page YAML Frontmatter**: Every wiki page must begin with a YAML frontmatter block containing metadata:
   ```yaml
   ---
   title: "Moving Average Crossover"
   type: strategy
   tags: [trend-following, moving-average, btc]
   created: 2026-07-13
   last_updated: 2026-07-13
   ---
   ```
3. **Internal Links**: Always use absolute file links to connect pages together. Format: `[Page Name](file:///c:/Users/gira/Desktop/backtesting/wiki/filename.md)`.
4. **Exclusividad de Activo (BTC)**: Toda estrategia, análisis y backtesting en este wiki debe enfocarse estrictamente en el par BTC/USDT (Bitcoin) — salvo la Estrategia 3 de la app (ETH/USDT), que es una excepción documentada y no un precedente para expandir el wiki a otros activos sin que el usuario lo pida.

---

## Operational Workflows

### 1. Ingesting Sources
When a new strategy description, raw log, or analysis is dropped into `wiki/sources/` or discussed in chat:
1. Read the source content thoroughly.
2. Draft a new page (or update an existing one) in `wiki/`.
3. Integrate the new information across the wiki: search for related strategy/concept files and add cross-references.
4. Update `wiki/index.md` to list the new or modified files.
5. Append an entry to `wiki/log.md` using the exact format:
   `## [YYYY-MM-DD] ingest | Title`

### 2. Querying & Synthesis
When answering user questions about strategies or performance:
1. Search `wiki/index.md` to locate relevant concept and strategy files.
2. Read the files to build a comprehensive answer.
3. If the query requires an in-depth comparison, custom matrix, or analysis, **save the compiled answer back into the wiki** as a new page, cross-link it, and log the action.

### 3. Linting & Health Checks
Periodically (or when requested), perform a health check on the wiki:
- Identify broken links or orphaned pages.
- Highlight contradictions in backtesting records or logic.
- Detect important concepts that are mentioned in files but lack their own dedicated page.
- Log the lint operation in `wiki/log.md` with:
   `## [YYYY-MM-DD] lint | Summary of checks`

---

## Project State — What Has Been Built (as of 2026-07-15)

This section is the **system memory**. Update it every time a major change is made to the app or wiki.

### 📱 Application: Antigravity Backtester

A fully functional single-page backtesting application running in the browser, deployed live on **GitHub Pages** (public — see the security note under "WhatsApp Alerts" below). It fetches live 4h candle data from Binance's public REST API (no API key required) and backtests **three strategy tabs** side-by-side in real time: Wyckoff Unificada (BTC), VWAP+EMA Cross (BTC), VWAP+EMA Cross (ETH).

**Key capabilities:**
- Live Binance API integration, 4h timeframe, last ~1000 candles per tab.
- Real-time last-candle update via WebSocket (`js/live-feed.js`, `LiveFeed` class).
- Three tabs per strategy view: Gráfico de Precios, Equity Curve, Historial de Operaciones.
- Signal state panel: shows in plain language WHY the system would or would not enter right now.
- Displays: Total Return %, Win Rate %, Completed Trades count, Max Drawdown %, Profit Factor.
- **Sistema de alertas** (`js/alerts.js`): beep sintetizado (Web Audio, sube en BUY/baja en SHORT), notificación nativa de escritorio (HTML5 Notification API), y toast visual animado como fallback — todo local al navegador, sin servicios externos. Toggle único de "Alertas" en la barra superior, sincronizado entre pestañas.
- Cada estrategia opera en su propio par: BTC/USDT para Wyckoff y Strategy 2, **ETH/USDT para Strategy 3** — no hay selector de activo manual, cada tab está fijo a su símbolo vía `STRATEGIES_CONFIG` en `js/app/main.js`.

---

### 📐 Strategy 1: Wyckoff Unificada (Main / Recommended)

**File**: `js/strategy-wyckoff.js`  
**Parameters**: `js/config.js` → `STRATEGY_PARAMS`

**Logic overview**:
1. **Event Detection** (`detectWyckoffEvents`): Rolling window of `lookback=15` candles computes `rangeHigh`, `rangeLow`, and `volSma`. Detects: `SPRING`, `SOS`, `LPS` (bullish) and `UTAD`, `SOW`, `LPSY` (bearish).
2. **Indicators computed**: Rolling VWAP (80), EMA21, EMA50, EMA Trend (50), ATR (14), Stochastic RSI (RSI14, Stoch24, K4, D3), Swing Pivot Levels (srBars=10).
3. **Entry scoring** (score ≥ 1 required):
   - StochRSI %K in oversold zone (< 20 for longs, > 85 for shorts): +1
   - Bullish/bearish %K–%D cross: +1
   - Price in Fibonacci 0.382–0.618 retracement zone within the Wyckoff range: +1
   - LPS/LPSY additionally require price above/below the macro EMA Trend — otherwise: –1
4. **Entry gates** (both required):
   - `strongCandle`: rejection strength `(close - low) / range ≥ 0.7`
   - `trendOk`: price within 3% of VWAP **and** EMA21 > EMA50 (bullish structure)
5. **Stop Loss**: `min(candle.low, close - ATR × 2.8)` — ATR-scaled, adaptive.
6. **Take Profit**: nearest major S/R pivot (if closer) or local range projection × `tpFraction=0.65`.
7. **Fallback exit**: Stochastic momentum reversal cross closes the open position without reversing (safety net for choppy markets).
8. **SOS/SOW are seed-only** — never traded directly (validated: trading raw breakout dilutes win rate vs. waiting for Spring/LPS).

**Validated backtesting results** (~1000 velas 4h BTC/USDT):
- Win Rate: ~78.5%
- Return: ~10–15%
- Max Drawdown: ~5%
- Profit Factor: ~2.5

---

### 📈 Strategy 2: VWAP + EMA Triple Cross (BTC/USDT) — RE-TUNED (2026-07-15), see correction below

**File**: `js/strategy-emacross.js` (function `runEmaCrossStrategy`, shared with Strategy 3)
**Parameters**: `js/config.js` → `STRATEGY2_PARAMS`
**Tab title**: "VWAP + Cruce EMA 24/30" (`index.html` nav button + `STRATEGIES_CONFIG` in `js/app/main.js`) — update this string again if `emaFast`/`emaSlow` change.

> ⚠️ **CORRECTION (2026-07-15) — the 2026-07-13 "roadmap CLOSED" conclusion below was based on an insufficient validation methodology and is superseded.** That work validated only against the live ~1000-candle window plus ONE historical out-of-sample window. When re-tested this session against **five non-overlapping 1000-candle windows** (~2.3 years, 2024-04 → 2026-07 — see [[project_backtesting_methodology]]-style validation, established this session), the old 21/30/vwap80/atr2.0/rr1.0 config actually **loses in 2 of the 5 windows** (−3.4% and −13.9% with 26.1% drawdown) — a real weakness that a single extra historical window didn't surface. Treat the "EMA period sweep", "VWAP period sweep", "stop/target grid" and other conclusions in the roadmap table further below as **stale** — they were the right rigor for the tools available at the time, but the 5-window methodology is now the bar for this strategy. The wiki pages `ema_periodos_cortos_vs_2130.md`, `analisis_profundo_mejoras_ema.md`, `analisis_temporalidades_1h_1d_ema.md` and `confirmacion_mtf_diaria_ema.md` were written under the old methodology and have not been re-validated against 5 windows — re-check before trusting their specific numbers.

**Current parameters** (`STRATEGY2_PARAMS`): `emaFast=24, emaSlow=30, vwapPeriod=105, atrPeriod=14, atrMult=3.75, rrRatio=0.5`.

**Logic overview** (unchanged): Entry fires when EMA-fast, EMA-slow, and VWAP achieve **full alignment** simultaneously (all three above/below each other in the same direction). Exit: SL/TP fires, or the **full opposite** alignment forms (no partial breakdown exit). Stop: `ATR × atrMult`. Target: `stopDist × rrRatio`.

**How the new params were found**: a 3-stage grid sweep (~639k parameter combinations total — wide pass across `emaFast` 3-60 / `emaSlow` 10-250 / `vwapPeriod` 10-400 / `atrMult` 1.0-4.0 / `rrRatio` 0.75-3.0, then two finer passes on the promising regions), each combination evaluated on the same 5 non-overlapping windows, requiring ≥12 closed trades/window to preserve the app's live trade frequency. Winner confirmed by neighborhood validation (varied each parameter independently): `emaFast` (20-28), `emaSlow` (26-34), `atrMult` (3.25-4.25) and `rrRatio` (0.25-1.0) are all genuine local peaks with graceful degradation on both sides — **not** overfit spikes. `vwapPeriod` is the one sensitive dimension: below 100 the config drops to only 3-4/5 profitable windows; the safe range is 105-120.

**Validated results** (avg / worst-window across the 5 non-overlapping windows):
- Win Rate: 81.6% avg (worst window 73.3%)
- Return: +20.4%/window avg (worst window +11.5% — every one of the 5 windows was individually profitable)
- Max Drawdown: 7.3% avg (worst window 11.3%)
- Trades: ~14/window (vs. ~18.6/window for the old config — similar activity level, by design)
- Profit Factor: 3.5 avg across windows

**Older, now-superseded content kept for historical record** — every applicable vector from [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) was validated on 2026-07-13 against the live window + ONE historical out-of-sample window (not the 5-window methodology above):
- **EMA fast/slow periods**: every pair in {7,14,21,30} tested — 21/30 won on every metric under that methodology; shorter pairs collapsed (7/14: +0.55% return, PF 1.05).
- **VWAP period**: full sweep 20→150 in steps of 5-10 — 80 was the apparent optimum under that methodology (superseded: 105-120 is the robust range under 5-window validation).
- **Stop/target geometry**: full `atrMult × rrRatio` grid (12 cells) — 2.0/1.0 was the apparent optimum under that methodology (superseded: 3.75/0.5 wins under 5-window validation).
- **Candle-body confirmation filter** (reject wick/doji trigger candles): helps the *rejected* shorter EMA pairs catch up partially, but reduced return when applied to 21/30.
- **Support/Resistance as Take-Profit** (same technique as Strategy 1): raised win rate to 82.4% but cut return to +14.00% (less than half) — a risk-profile trade-off, not re-tested against the new params.
- **Exit management** (breakeven-after-1R, ATR trailing stop): zero effect at `rrRatio=1.0` (not re-tested at the new `rrRatio=0.5`).
- **Volume filter & Bollinger Bandwidth squeeze filter**: both looked like clear wins on the LIVE window (PF 3.9-6.8) but **collapsed to PF 0.3-1.0 on the historical window** — textbook regime mirages, rejected under either methodology.
- **ATR-percentile volatility regime filter**: improved robustness under the old methodology at the cost of live-window return — not re-tested against the new params.
- **Timeframe**: tested on 1h (6000 candles) and 1d (3000 candles, back to 2018) — **both rejected**; 1h is structurally break-even (noise + fee drag), 1d has 24-52% drawdowns. **4h remains intrinsic to the edge** (this conclusion is independent of the specific EMA/VWAP params and still holds).
- **Multi-timeframe daily EMA gate**: tested EMA{20,50,100,200} daily as a hard/soft entry gate — rejected under the old methodology, not re-tested against the new params.
- Item #9 (position sizing by conviction) remains untested for this strategy — a different lever (sizing, not entry/exit logic) than anything above.

---

### 🔧 Simulator Engine

**File**: `js/simulator.js`

- Cash-settled 1x futures model (no leverage, no funding rate, no liquidation).
- Full-equity sizing (100% of cash deployed per trade).
- Intrabar SL/TP check: stop checked against `candle.low` (LONG) or `candle.high` (SHORT) before processing new signals. Conservative tie-breaking: if both SL and TP are hit in the same candle, stop triggers first.
- Reversal logic: a BUY closes any open SHORT first; a SHORT closes any open LONG first.
- Momentum-only exits (`EXIT_LONG_MOMENTUM` / `EXIT_SHORT_MOMENTUM`) close without reversing.
- Computes: equityCurve, maxDrawdown, profitFactor, totalTrades.

---

### 📚 Wiki Knowledge Base — Pages

| File | Type | Summary |
|---|---|---|
| [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) | index | Central TOC for all wiki pages |
| [log.md](file:///c:/Users/gira/Desktop/backtesting/wiki/log.md) | log | Chronological action ledger |
| [metodo_wyckoff.md](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md) | concept | Full Wyckoff theory: 5-step approach, 3 laws, accumulation/distribution phases, 9 buy/sell tests, P&F projection, BTC-specific adaptations |
| [cruce_de_medias.md](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) | strategy | EMA/SMA crossover theory + backtest record: EMA9/21, 500 velas BTC 4h → −11.82% return, 21.4% win rate, bad in choppy markets |
| [rsi_reversion_media.md](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md) | strategy | RSI mean reversion at 30/70 levels |
| [macd_crossover.md](file:///c:/Users/gira/Desktop/backtesting/wiki/macd_crossover.md) | strategy | MACD signal line crossover for momentum/trend detection |
| [bandas_de_bollinger.md](file:///c:/Users/gira/Desktop/backtesting/wiki/bandas_de_bollinger.md) | strategy | Bollinger Bands contrartrend & volatility breakout |
| [conceptos_smart_money.md](file:///c:/Users/gira/Desktop/backtesting/wiki/conceptos_smart_money.md) | concept | SMC theory: Order Blocks, Liquidity Pools, MSS/CHoCH, + quantitative Gaussian Fibonacci HPZ model (72% accuracy, Gapat et al. 2026) |
| [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) | analysis | 9 concrete improvement vectors for both strategies: entry filters, SL/TP management, volatility regime, MTF, scoring, sizing. Root source of every Strategy 2 experiment below; items 1-2, 5-6 and 9 still open for Strategy 1 (Wyckoff) |
| [ema_periodos_cortos_vs_2130.md](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md) | analysis | Strategy 2: all EMA fast/slow pairs in {7,14,21,30} tested real-data — 21/30 wins on every metric, monotonic degradation as periods shorten |
| [filtro_cuerpo_vela_cruce_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md) | analysis | Strategy 2: candle-body (no-wick) confirmation filter — rescues the rejected short EMA pairs partially, but reduces return when applied to 21/30 |
| [soporte_resistencia_take_profit_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/soporte_resistencia_take_profit_ema.md) | analysis | Strategy 2: S/R pivots (same technique as Strategy 1) as TP target — raises win rate to 82.4% but cuts return to less than half; risk-profile trade-off, not a net win |
| [analisis_profundo_mejoras_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md) | analysis | Strategy 2: deep sweep on 3000-candle history (atrMult×rrRatio grid, VWAP fine sweep 20-150, trailing/breakeven, volume filter, ATR-percentile filter, Bollinger squeeze, LONG/SHORT decomposition) — exposes regime dependency (+8.5% in the 2025 window vs +31.4% live) and two regime mirages (volume & Bollinger filters) |
| [analisis_temporalidades_1h_1d_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_temporalidades_1h_1d_ema.md) | analysis | Strategy 2: same deep sweep replicated on 1h (6000 candles) and 1d (3000 candles, back to 2018) — both timeframes rejected (1h break-even, 1d drawdowns 24-52%); 4h confirmed intrinsic to the edge |
| [confirmacion_mtf_diaria_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/confirmacion_mtf_diaria_ema.md) | analysis | Strategy 2: multi-timeframe daily EMA gate (roadmap item "MTF confirmation") tested with no-lookahead daily mapping across EMA{20,50,100,200} — rejected, closes the Strategy 2 roadmap entirely |

---

### 🗺️ Open Improvement Roadmap (Pending Validation)

Documented in [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md). Each item must be validated in-sample first, then out-of-sample, **one at a time**, before touching production code.

**Strategy 2 (VWAP+EMA Cross, BTC) — table below is STALE (superseded 2026-07-15).** Every item was tested exhaustively on 2026-07-13 against the live window + one historical window (see the 5 analysis pages above), but that methodology missed a real weakness (see the correction under Strategy 2's own section above) and current `STRATEGY2_PARAMS` are no longer 21/30/vwap80/atr2.0/rr1.0. Kept for historical record only — if revisiting any of these levers, re-validate against the 5-non-overlapping-window methodology from scratch, don't assume these conclusions still hold:

| # | Improvement | Result |
|---|---|---|
| 3 | ATR Percentile filter | Improves robustness (historical PF 1.27→1.68) but cuts live return (+25%→+16%) — a risk-profile choice, not adopted |
| 6 | Trailing stop after 1:1 R:R | Zero effect — fixed 1:1 target reached before trailing can activate |
| 7 | Bollinger Bands regime filter | **Regime mirage** — PF 6.76 live but PF 1.01 on historical window; rejected |
| 8 | Multi-timeframe confirmation (EMA daily) | Cuts live return in half, turns historical window negative; rejected |
| — | Volume filter (variant of #4, applied to EMA Cross) | **Regime mirage** — PF 3.94 live but PF 0.32 on historical window; rejected |
| — | EMA period sweep (not in original roadmap, done first) | 21/30 confirmed optimal across {7,14,21,30} |
| — | VWAP period fine sweep 20-150 | 80 confirmed optimal, secondary peaks at 55/65 are fragile |
| — | Candle-body confirmation filter | Helps rejected short EMA pairs partially, hurts 21/30 |
| — | S/R as Take-Profit target | Trades return for win rate, not a net improvement |
| — | Timeframe change (1h / 1d) | Both rejected — 4h is intrinsic to the edge |
| 9 | Scaled position sizing by confluence score | **Not yet tested for Strategy 2** — Strategy 2 has no confluence score (binary alignment signal), would need its own design; low priority given the above |

**Strategy 1 (Wyckoff) — still open**, none of these have been implemented or tested yet:

| Priority | Improvement | Target File | Complexity |
|---|---|---|---|
| 1 | Score ≥ 2 required for LPS/LPSY entries | `strategy-wyckoff.js` | Mínima |
| 2 | R:R ≥ 1.5 filter before opening any trade | `strategy-wyckoff.js` | Mínima |
| 3 | ATR Percentile-80 filter (no trading in extreme volatility) | `indicators.js` + strategies | Baja |
| 4 | Volume ≥ 1.2× volSma required on Spring/UTAD detection | `strategy-wyckoff.js` | Baja |
| 5 | Classic RSI(14) as 4th confluence score point | `strategy-wyckoff.js` | Baja |
| 6 | Trailing stop activated after 1:1 R:R | `simulator.js` | Media |
| 9 | Scaled position sizing by confluence score (33/66/100%) | `simulator.js` | Alta |

> **OVERFITTING WARNING**: Never implement more than 2–3 of these simultaneously without separate in-sample + out-of-sample validation windows. `config.js` already documents this constraint. The Strategy 2 experiments above are the reference example of doing this right: every single item was tested in isolation against both a live window and a genuinely separate historical window before being accepted or rejected.

---

### 📲 WhatsApp Alerts — Deferred Initiative

User asked (2026-07-13) about pushing signal alerts to WhatsApp instead of only browser-local alerts. **Not implemented — deferred at user's request**, pending a decision between:
- **CallMeBot** (recommended candidate): free, no backend needed, plain `GET` request from client JS — but the API key would need to live in `localStorage` (entered once via a settings input), **never hardcoded in `config.js`**, because the app is deployed publicly on GitHub Pages and anything in the JS source is visible to anyone.
- **Twilio WhatsApp API**: more robust but requires a backend/proxy to protect credentials — incompatible with the current 100%-static architecture without adding new infrastructure.
- **Webhook relay (Zapier/Make/IFTTT)**: middle ground, avoids exposing WhatsApp credentials directly but adds another external dependency.

When resumed, revisit this section and the `js/alerts.js` file (already has the deduplication + trigger plumbing in `checkAndTriggerAlert()` that a WhatsApp sender would hook into).

---

### 🎵 Strategy 4 Attempt: "Oracle Move" — IMPLEMENTED, THEN REVERTED (2026-07-15)

A 4th BTC/USDT tab was added implementing a Hull-MA-style double moving average crossover (`ma3 = 2×MA(n/2) − MA(n)`, `ma4 = MA(ma3, √n)`, cross between the two as the signal), ported from a Pine Script indicator the user provided ("Oracle Move [wm]"). Full history for context, in case anything similar is requested again:
- **Direction bug caught by the user from a chart screenshot**: the first implementation had the cross direction inverted (fired LONG on the bearish cross). This is what motivated moving to the 5-non-overlapping-window + neighborhood-stability validation methodology described in "Critical Technical Constraints" above — the buggy version's "validated" params had looked robust under a weaker 3-window check.
- Post-fix, a raw ma3/ma4 cross topped out at ~40-41% win rate (no confluence filter). Adding a rolling-VWAP trend gate (same technique as Strategy 2 — only take the cross if price agrees with VWAP) raised it to ~58-64% win rate with much better drawdown, confirmed via the same multi-window + neighborhood methodology.
- **Reverted at user's request** ("no me aporta nada," 2026-07-15) once Strategy 2 was re-tuned to a stronger result using the same methodology — not because the approach was flawed, but because it stopped being a distinct enough addition once Strategy 2 improved. Fully removed: `js/strategy-oraclemove.js` deleted, and every touchpoint reverted (tab button + script tag in `index.html`, `STRATEGIES_CONFIG` entry / `Promise.all` / `setupLiveFeed` / alert event-type branching in `js/app/main.js`, `STRATEGY4_PARAMS` in `js/config.js`, strategy label in `js/alerts.js`, `ORACLE_CROSS_UP/DOWN` in `js/ui/dom-utils.js`, the generic `showVwap`/`maLabelPrefix` plumbing added to `js/ui/signal-panel.js` and `js/app/main.js` for it, and the now-unused `wmaSeries`/`emaSeries`/`almaSeries`/`calculateWMA`/`calculateALMA` helpers in `js/indicators.js`).
- **Don't re-propose a 4th indicator-based strategy tab unless explicitly asked.** The stable set is the 3 tabs described above (Wyckoff, VWAP+EMA BTC, VWAP+EMA ETH). If a similar Pine Script/indicator port is requested again, the validation methodology above (5 windows + neighborhood check, VWAP trend gate as a first-line quality lever) is the proven starting point — no need to rediscover it.

---

### ⚙️ Critical Technical Constraints

1. **No lookahead bias**: All indicator and event data used at candle `i` must be computed only from candles `0..i-1`. The codebase enforces this via two-pointer pivot scanning and the `confirmedAt = p + bars` logic in `detectSwingLevels`.
2. **Parameter changes require re-validation**: Any change to `STRATEGY_PARAMS`, `STRATEGY2_PARAMS`, or `STRATEGY3_PARAMS` must be backtested against **at least 3-5 non-overlapping historical windows** (not just the live window + one extra window — that weaker check missed a real failure mode in Strategy 2, see the correction under Strategy 2 above) and confirmed stable across a **parameter neighborhood** (vary each param ±1-2 steps; a real optimum degrades gracefully on both sides, an overfit spike collapses sharply) before being kept.
3. **Binance CORS**: The app calls `api.binance.com` directly. No proxy is used. Yahoo Finance / yfinance was attempted for a third strategy (equities) but all free CORS proxies were blocked — Strategy 3 was switched to ETH/USDT on Binance instead.
4. **Strategy 3 (ETH/USDT)**: Uses the same `runEmaCrossStrategy` engine with `STRATEGY3_PARAMS` (EMA19/45, VWAP55). Results: 23 trades, 69.6% win rate, 30.51% return, 8.30% drawdown, PF 1.93. Confirmed stable across the neighborhood of nearby periods.
5. **Simulation model**: 1x cash-settled futures (no real leverage). Fee = 0.1% per side. Initial capital = $100 (for % return calculation).

---

## 🏛️ Clean Code & Architecture Standards

This section is **mandatory** for all future code contributions to the application. Every AI agent or human contributor must read and enforce these standards before writing or modifying any `.js` or `.html` file.

---

### 📐 Target Architecture (Component Model)

The codebase is organized in layered modules by **responsibility**, enforced through discipline (no build step/linter enforcing it) rather than folder structure. Each layer may only depend on layers below it. **This reflects the file layout as it actually exists today** — an earlier draft of this document proposed moving Layer 1/2 into `js/core/`/`js/data/` subfolders; that part of the plan was never executed and has been dropped. Don't create those folders — the current flat placement of Core/Infra files at `js/` root is the accepted final state:

```
Layer 4 — App Bootstrap
  js/app/main.js             — Orquesta todo. Sin lógica de negocio ni de UI.

Layer 3 — UI Components (presentation only, no business logic)
  js/ui/strategy-view.js     — Tabs + resize per strategy view. Class: StrategyView.
  js/ui/metrics-panel.js     — Metric cards (Return, Win Rate, Drawdown, PF). Class: MetricsPanel.
  js/ui/signal-panel.js      — Live signal checklist panel. Class: SignalPanel.
  js/ui/trades-table.js      — Trade history table rendering. Class: TradesTable.
  js/ui/dom-utils.js         — Pure helpers: EVENT_LABELS, formatDate(), formatPrice(), CSS_CLASSES.
  js/alerts.js               — Alert manager: sound/notification/toast triggers + settings sync.

Layer 2 — Infrastructure / Rendering (flat at js/ root, NOT under js/data/)
  js/chart/chart-manager.js  — Generic chart wrapper. Class: ChartManager(priceEl, equityEl, accentColor).
  js/live-feed.js            — WebSocket feed. Class: LiveFeed extends EventTarget.
  js/binance-api.js          — REST wrapper. Pure function: fetchBinanceKlines().

Layer 1 — Core (IMMUTABLE — pure functions, no side effects, no DOM; flat at js/ root, NOT under js/core/)
  js/config.js                — Strategy parameters (STRATEGY_PARAMS/STRATEGY2_PARAMS/STRATEGY3_PARAMS). NEVER touch without re-validation.
  js/indicators.js            — Pure math: ATR, VWAP, EMA, RSI, StochRSI, SwingLevels.
  js/simulator.js             — Pure backtest engine: runSimulator().
  js/strategy-wyckoff.js      — Pure strategy: runWyckoffUnifiedStrategy().
  js/strategy-emacross.js     — Pure strategy: runEmaCrossStrategy() (shared by Strategy 2 and 3).
```

> **RULE**: Layer 1 (Core) files must NEVER import or reference any DOM, WebSocket, fetch, or UI concept. They receive data arrays and return result objects — nothing else. This rule has held in practice: `alerts.js` (which does touch the DOM) correctly lives in Layer 3, not Layer 1, despite sitting at `js/` root next to the Core files — the layer is about behavior, not folder location.

---

### 🧱 SOLID Principles — Enforcement Rules

#### S — Single Responsibility
- Each class/function has **exactly one reason to change**.
- Violation signal: a function name contains "and" (e.g. `fetchAndRender`) → split it.
- `ChartManager` renders charts. It does NOT fetch data, manage tabs, or update metrics.
- `MetricsPanel` displays metrics. It does NOT compute them or know about strategies.

#### O — Open/Closed
- Adding a new strategy (Strategy 4) must require **zero changes** to `ChartManager`, `MetricsPanel`, `SignalPanel`, or `TradesTable`.
- All these classes accept a `suffix` or `options` parameter at construction time to handle any strategy instance.
- Violation signal: you need to add a `case 4:` or `if (strategy === 'new')` inside an existing class.

#### L — Liskov Substitution
- `StrategyView` must work identically for Wyckoff, EMA Cross, and ETH tabs — no type-checking inside.
- `SignalPanel` renders from a `state` object shape. Wyckoff and EMA Cross states share the same interface shape (extra fields are simply ignored).

#### I — Interface Segregation
- Components depend only on what they actually use.
- `TradesTable` does NOT receive the full `results` object — only `results.trades` and `results.eventLabels`.
- `MetricsPanel` does NOT receive `candles` or `indicators`.

#### D — Dependency Inversion
- `main.js` wires everything together. High-level modules (strategies) do not depend on low-level modules (DOM, WebSocket).
- `LiveFeed` fires events (`'price'`, `'candleClose'`). It does NOT call `updateSignalPanel` or `candlestickSeries.update()` directly.
- `main.js` listens to `LiveFeed` events and delegates to the appropriate component.

---

### 🧹 Clean Code Rules

#### Naming
- **Classes**: `PascalCase` — `ChartManager`, `MetricsPanel`, `SignalPanel`.
- **Functions/methods**: `camelCase`, verb-first — `render()`, `updateLiveCandle()`, `setLoading()`.
- **Constants**: `SCREAMING_SNAKE_CASE` — `STRATEGY_PARAMS`, `EVENT_LABELS`, `CSS_CLASSES`.
- **Files**: `kebab-case` — `chart-manager.js`, `metrics-panel.js`, `dom-utils.js`.
- **IDs in HTML**: `kebab-case` with strategy suffix — `metric-return-1`, `signal-panel-2`.
- No abbreviations in names unless universally known (`ATR`, `EMA`, `VWAP`, `SL`, `TP`).

#### Functions
- Maximum **20 lines** per function. If longer, extract a named sub-function.
- Maximum **3 parameters**. If more are needed, use a config object: `render(candles, results, options)`.
- No function should both compute a value AND produce a side effect. Pure functions return values; methods with side effects return `void`.
- Early returns over nested `if` blocks.

#### Variables & State
- `const` by default. `let` only when reassignment is necessary. `var` is **forbidden**.
- No implicit global state. Every shared value must be a property of a named class instance.
- Violation signal: a bare `let someVar = null` at the top of a file that is read/written by two different functions from different files.

#### Comments
- Comments explain **WHY**, not **WHAT**. Code explains what.
- Every public method in a class has a one-line JSDoc comment.
- Every file starts with a header comment: module name, layer, dependencies, exported API.
- Delete commented-out code — use Git history instead.

#### DRY (Don't Repeat Yourself)
- If the same logic appears in two places, extract it to a shared utility.
- The pattern `updateMetrics` / `updateMetrics2` / `updateMetrics3` is the canonical anti-pattern to avoid. The correct version is one `MetricsPanel` class instantiated three times.
- The pattern `renderCharts` / `renderCharts2` / `renderCharts3` (480 lines) is the canonical anti-pattern in `charts.js`. The correct version is one `ChartManager` class.

---

### 🌐 Semantic HTML Standards

All structural HTML must use semantic elements:

| Context | Element to use | NOT this |
|---|---|---|
| Main app content area | `<main>` | `<div id="main">` |
| Navigation bar / strategy switcher | `<nav>` | `<div class="nav">` |
| Sidebar with metrics + signal | `<aside>` | `<div class="sidebar">` |
| Each strategy's view container | `<section>` | `<div class="view">` |
| Each metric card | `<article>` | `<div class="card">` |
| App title bar | `<header>` | `<div class="header">` |
| Tab system | `role="tablist"` + `role="tab"` + `role="tabpanel"` | Plain buttons + divs |

#### Accessibility (ARIA) — mandatory
- Tab buttons: `role="tab"`, `aria-selected="true/false"`, `aria-controls="panelId"`.
- Tab panels: `role="tabpanel"`, `aria-labelledby="tabId"`, `id="panelId"`.
- Icon-only buttons: `aria-label="descriptive name"`.
- Live signal panel (updates every 1.5s): `aria-live="polite"`.
- Status dots (API active/error): `aria-label="Estado API: activa"` or `"error"`.

---

### 📱 Responsive Layout Standards — Mobile-First with CSS Grid (2026-07-15)

The app was converted to a **mobile-first** layout using **Tailwind's CSS Grid utilities** for every structural section (the pre-existing flex-based layout was replaced). All new layout work must follow this pattern:

- **Structural sections use `grid`, not `flex`.** Flex is reserved for simple inline alignment (an icon next to a label, a row of badges) — anything that divides the page into named regions (nav, sidebar + dashboard split, dashboard's tab-bar + content rows, tab panels' header + chart rows) uses `grid grid-cols-[...]` / `grid-rows-[...]`. Reference implementation: `index.html` — `body` (`grid grid-rows-[auto_1fr]`), `nav` (`grid grid-cols-1 md:grid-cols-[1fr_auto]`), `.strategy-view` (`grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)]`), the dashboard column (`grid grid-rows-[auto_1fr]`), and each tab panel section (`grid grid-rows-[auto_1fr]`).
- **Mobile-first breakpoints, `lg:` gates desktop-only behavior.** Base (unprefixed) classes target mobile: natural document scroll (`min-h-screen`, no `overflow-hidden`), single-column grids, content-driven heights. `lg:` prefixed classes restore the desktop-locked-viewport behavior (`lg:h-screen lg:overflow-hidden`, multi-column grid-template, `lg:h-full` on charts) established by an earlier design decision (commit `98394cf`) to eliminate outer scrollbars on desktop. Do not remove the desktop lock — only mobile gained scroll.
- **Chart containers use `dvh` + `min-h`, not fixed pixel heights.** `h-[680px]` / `h-[600px]` were replaced with `h-[55dvh] min-h-[320px] lg:h-full` (main chart) and `h-[50dvh] min-h-[280px] lg:h-full` (equity chart) — `dvh` avoids the mobile browser chrome resize bug that `vh` has, and `lg:h-full` derives desktop height from the parent grid row instead of a magic-number pixel value. `ChartManager` ([js/chart/chart-manager.js](c:\Users\gira\Desktop\backtesting\js\chart\chart-manager.js)) needs no changes for this — it already sizes off `clientHeight` via `ResizeObserver`.
- **Horizontal scroll containers for anything that can't reflow on narrow screens**: the strategy-switcher nav and the dashboard tab bar use `overflow-x-auto snap-x` with `shrink-0 whitespace-nowrap snap-start` buttons (a carousel, not a wrap) since 3 tabs don't fit a 360px-wide screen; the trade-history table wraps in `overflow-auto` with `min-w-[720px]` on the `<table>` itself so 9 columns scroll horizontally instead of compressing illegibly.
- **Gotcha — `className` full-replacement wipes structural classes.** `StrategyView.initStrategySwitcher()` ([js/ui/strategy-view.js](c:\Users\gira\Desktop\backtesting\js\ui\strategy-view.js)) sets `btn.className = CSS_CLASSES.STRATEGY_TAB_ACTIVE_WYCKOFF / _CROSS / _INACTIVE` on every click — this **replaces the entire class list**, not just the active/inactive styling. Any layout utility class added to those buttons in `index.html` (e.g. `shrink-0 whitespace-nowrap snap-start` for the mobile carousel) must **also** be baked into those three `CSS_CLASSES` constants in `js/ui/dom-utils.js`, or it silently disappears the first time the user clicks a tab. Same root-container gotcha for the `.strategy-view` grid: `classList.toggle('flex'/'grid', ...)` in `js/ui/strategy-view.js` (both `setupTabs`'s panel toggle and `initStrategySwitcher`'s root toggle) and the initial `classList.add(...)` for the default-visible Wyckoff tab in `js/app/main.js` must match whatever display value (`grid`, not `flex`) the corresponding container actually uses — these three JS toggle points are easy to miss when changing a container's display type in the HTML.

---

### ⚡ Performance Standards

#### DOM Operations
- Use `DocumentFragment` when inserting multiple rows into a table — never call `appendChild` in a loop against the live DOM.
- Cache DOM element references in class constructors (`this.returnEl = document.getElementById(...)`). Never query the DOM inside a frequently-called update method.
- For toggling visibility, prefer `hidden` attribute or a single CSS class toggle over setting `classList` of 4 separate classes.

#### Event Listeners
- Register `window.addEventListener('resize', ...)` **exactly once** per application lifecycle, using a `ResizeObserver` per chart container instead of polling `clientWidth`.
- Use `{ passive: true }` on scroll and resize listeners.
- Remove listeners on component destruction: `this.resizeObserver.disconnect()`.

#### Rendering Throttle
- Live signal state recomputation (running full strategy over ~1000 candles) is throttled at **1500ms** minimum between updates. This value is defined as `LiveFeed.LIVE_UPDATE_THROTTLE_MS = 1500` — not a magic number in code.
- Use `requestAnimationFrame` for visual updates that must be synchronized with the browser paint cycle (e.g. price badge color changes).

#### Memory
- Chart instances (`LightweightCharts`) must be explicitly `destroy()`ed before creating new ones — `ChartManager.destroy()` handles this.
- WebSocket connections must be explicitly `close()`d before reconnecting — `LiveFeed.disconnect()` handles this.
- No circular references between components (enforced by the layer dependency rule above).

---

### 🎨 CSS & Styling Standards

#### CSS Custom Properties (Design Tokens)
Define all color and shadow tokens in `:root` — never hardcode hex or rgba strings in JavaScript:
```css
:root {
  --color-neon-cyan:    #00e5ff;
  --color-neon-emerald: #00e676;
  --color-neon-rose:    #ff1744;
  --color-neon-purple:  #b388ff;
  --shadow-cyan:   0 0 8px rgba(0, 229, 255, 0.3);
  --shadow-green:  0 0 8px rgba(0, 230, 118, 0.3);
  --shadow-red:    0 0 8px rgba(255, 23, 68, 0.3);
}
```

#### CSS Class Strings in JavaScript
- All reusable class strings are centralized in `js/ui/dom-utils.js` as `CSS_CLASSES` (frozen object).
- Example: `CSS_CLASSES.DOT_OK = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shrink-0'`
- Never repeat a class string literal in more than one place in the codebase.

---

### 🚫 Anti-Patterns — Banned in This Codebase

| Anti-pattern | Why it's banned | Correct alternative |
|---|---|---|
| Numbered function copies (`fn1`, `fn2`, `fn3`) | Violates DRY and OCP | Single class with instance params |
| `var` declarations | Hoisting + scope confusion | `const` / `let` |
| Implicit global `let` shared across files | Hidden coupling, race conditions | Class instance properties |
| `element.innerHTML = longHtmlString` in loops | XSS vector + reflow | `DocumentFragment` + `createElement` |
| `window.addEventListener` called multiple times for same event | Memory leaks | Single listener + `ResizeObserver` |
| CSS class strings hardcoded in JS | Untrackable, breaks refactors | `CSS_CLASSES` token object |
| Functions longer than 20 lines | Too many responsibilities | Extract named sub-functions |
| Comments that say WHAT the code does | Noise, gets stale | Comments that say WHY |
| Mixing data fetching + rendering in one function | Violates SRP | Separate fetch from render |

---

### 📋 Code Review Checklist

Before any code is committed or considered done, verify:

- [ ] The file's layer dependency is respected (no Core file touching DOM).
- [ ] No new global `let` / `var` variables added at module scope.
- [ ] No function longer than 20 lines (count them).
- [ ] No string literal CSS class duplicated in more than one place.
- [ ] Semantic HTML element used where a structural `div` would have worked.
- [ ] `aria-*` attributes added to interactive elements.
- [ ] `const` used everywhere possible; `let` only where reassignment is provably needed.
- [ ] New `window.addEventListener` calls are zero (use existing listener or `ResizeObserver`).
- [ ] Chart instances and WebSocket connections are properly destroyed before recreating.
- [ ] If a second strategy view was added, zero changes were needed in Core layer files.
- [ ] The app loads without errors in browser console after the change.
- [ ] The backtest metrics (Win Rate, Return%, Max Drawdown) are unchanged vs. before the change.

---

### 🗂️ Architecture Refactor — CLOSED (2026-07-14)

The full refactor plan below was completed and verified against the live app (metrics unchanged, no console errors). **All items done — this table is now historical record, not a pending task list.** Note the two corrections vs. the original plan: `LiveFeed` and `fetchBinanceKlines` ended up staying flat at `js/` root (`js/live-feed.js`, `js/binance-api.js`), not under a `js/data/` folder as first proposed — see the Target Architecture note above.

| Task | Status | Files involved |
|---|---|---|
| Extract `ChartManager` class (replaces 3 copy-paste `renderCharts*` blocks) | ✅ Done | `charts.js` → `js/chart/chart-manager.js` |
| Extract `MetricsPanel` class (replaces `updateMetrics*` × 3) | ✅ Done | `ui.js` → `js/ui/metrics-panel.js` |
| Extract `SignalPanel` class (replaces `updateSignalPanel*` × 3) | ✅ Done | `ui.js` → `js/ui/signal-panel.js` |
| Extract `TradesTable` class (replaces `populateTradesTable*` × 3) | ✅ Done | `ui.js` → `js/ui/trades-table.js` |
| Extract `StrategyView` class (replaces `setupTabs` + `setupStrategySwitcher`) | ✅ Done | `ui.js` → `js/ui/strategy-view.js` |
| Extract `dom-utils.js` (CSS_CLASSES, EVENT_LABELS, formatDate, formatPrice) | ✅ Done | `ui.js` → `js/ui/dom-utils.js` |
| Refactor `LiveFeed` as `EventTarget` class (eliminates cross-file coupling) | ✅ Done | `live-feed.js` → `js/live-feed.js` (stayed at root, not `js/data/`) |
| Refactor `main.js` as pure orchestrator | ✅ Done | `main.js` → `js/app/main.js` |
| Add semantic HTML (`<main>`, `<nav>`, `<aside>`, `<section>`, ARIA roles) | ✅ Done | `index.html` |
| Consolidate all `window.addEventListener('resize')` → single `ResizeObserver` | ✅ Done | `charts.js` (currently 3 listeners) |
| Add `CSS_CLASSES` token object (eliminate hardcoded class strings in JS) | ✅ Done | `ui.js`, `live-feed.js` |
| Replace 3× copy-pasted view markup with one HTML5 `<template>` cloned per strategy | ✅ Done | `index.html` (714→311 lines, −60%), `js/ui/strategy-view.js`, `js/app/main.js` (`STRATEGIES_CONFIG`-driven instantiation) |
| Add alert/notification system (sound + desktop notification + toast) | ✅ Done | New file `js/alerts.js`, wired via `live-feed.js`/`main.js` |

Since this closed, the only structural item still open is the deferred WhatsApp alert integration (see "📲 WhatsApp Alerts" above) — not a refactor, a new feature, and intentionally paused.
