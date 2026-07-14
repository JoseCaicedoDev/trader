# LLM Wiki Schema & Agent Instructions

This workspace contains a personal knowledge base (LLM Wiki) dedicated to trading strategies, quantitative analysis, and backtesting experiments focused **exclusively on BTC/USDT (Bitcoin)**.

As the AI agent in this workspace, you are the **Wiki Maintainer**. You must follow the instructions below to ensure that the wiki remains organized, consistent, and compounding over time.

---

## Directory Structure

All wiki files are located in the workspace folder `wiki/`:
- `wiki/` — The compiled, LLM-generated markdown files representing entity pages, concepts, strategies, and performance summaries.
- `wiki/sources/` — Immutable source materials (clipped web pages, text drafts, screenshots, strategy guidelines) dropped by the user.
- `wiki/index.md` — The central table of contents (index) for navigation.
- `wiki/log.md` — Chronological ledger of all actions performed (ingests, lint checks, test runs).

The live backtesting application lives in the root workspace:
- `index.html` — Single-page app entry point (Antigravity Backtester | Estrategia Unificada Wyckoff BTC/USDT).
- `js/config.js` — All strategy parameters (do NOT change without re-validating on real BTC data).
- `js/indicators.js` — Pure indicator library: ATR, Rolling VWAP, EMA, RSI, Stochastic RSI, Swing Levels.
- `js/simulator.js` — General backtest engine (Long & Short, cash-settled 1x futures model).
- `js/strategy-wyckoff.js` — **Strategy 1**: Wyckoff Unificada (main strategy, recommended default).
- `js/strategy-emacross.js` — **Strategy 2**: VWAP + EMA Triple Cross (reference/comparison).
- `js/charts.js` — LightweightCharts rendering layer.
- `js/ui.js` — All DOM manipulation, signal panels, trade history table.
- `js/main.js` — App bootstrap, data fetch orchestration.
- `js/binance-api.js` — Binance REST wrapper (CORS-safe via direct API calls).
- `js/live-feed.js` — WebSocket live feed for the last candle update.

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
4. **Exclusividad de Activo (BTC)**: Toda estrategia, análisis y backtesting en este wiki debe enfocarse estrictamente en el par BTC/USDT (Bitcoin).

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

## Project State — What Has Been Built (as of 2026-07-13)

This section is the **system memory**. Update it every time a major change is made to the app or wiki.

### 📱 Application: Antigravity Backtester

A fully functional single-page backtesting application running in the browser. It fetches live BTC/USDT 4h candle data from Binance's public REST API (no API key required) and backtests two strategies side-by-side in real time.

**Key capabilities:**
- Live Binance API integration (BTCUSDT, 4h, last ~1000 candles).
- Real-time last-candle update via WebSocket (`live-feed.js`).
- Three tabs: Gráfico de Precios, Equity Curve, Historial de Operaciones.
- Signal state panel: shows in plain language WHY the system would or would not enter right now.
- Displays: Total Return %, Win Rate %, Completed Trades count, Max Drawdown %, Profit Factor.
- All data is BTC/USDT only — asset selector was removed and hardcoded.

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

### 📈 Strategy 2: VWAP + EMA Triple Cross (Reference)

**File**: `js/strategy-emacross.js`  
**Parameters**: `js/config.js` → `STRATEGY2_PARAMS`

**Logic overview**:
- Entry fires when EMA21, EMA30, and VWAP (80) achieve **full alignment** simultaneously (all three above/below each other in the same direction). The triggering cross is whichever of the three pairwise combinations completes the alignment last.
- Exit: SL/TP fires, or the **full opposite** alignment forms (no partial breakdown exit — validated to raise combined return 23.8% → 42.7% while lowering drawdown 17.2% → 9.2%).
- Stop: `ATR × 2.0` from entry close.
- Target: `stopDist × rrRatio (1.0)` — 1:1 risk:reward fixed.

**Validated backtesting results** (~1000 velas 4h BTC/USDT):
- Win Rate: 76.5%
- Return: +31.4%
- Max Drawdown: −4.37%
- Trades: 17 completed

**Parameter stability**: Confirmed stable across EMA periods 18–24 / 25–35 / VWAP 65–95. A fast=7/slow=15/vwap=20 candidate was **rejected** as overfitted (collapsed −34% on a 10-period VWAP shift). Parameters moved from 25/50 to 21/30 raised win rate 69.2% → 76.5% and return 13.55% → 31.4%.

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
| [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) | analysis | 9 concrete improvement vectors for both strategies: entry filters, SL/TP management, volatility regime, MTF, scoring, sizing |

---

### 🗺️ Open Improvement Roadmap (Pending Validation)

These improvements are documented in [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) and have NOT yet been implemented. Each must be validated in-sample first, then out-of-sample, **one at a time**:

| Priority | Improvement | Target File | Complexity |
|---|---|---|---|
| 1 | Score ≥ 2 required for LPS/LPSY entries | `strategy-wyckoff.js` | Mínima |
| 2 | R:R ≥ 1.5 filter before opening any trade | `strategy-wyckoff.js` | Mínima |
| 3 | ATR Percentile-80 filter (no trading in extreme volatility) | `indicators.js` + strategies | Baja |
| 4 | Volume ≥ 1.2× volSma required on Spring/UTAD detection | `strategy-wyckoff.js` | Baja |
| 5 | Classic RSI(14) as 4th confluence score point | `strategy-wyckoff.js` | Baja |
| 6 | Trailing stop activated after 1:1 R:R | `simulator.js` | Media |
| 7 | Bollinger Bands regime filter for EMA Cross entries | `strategy-emacross.js` | Baja |
| 8 | Multi-timeframe confirmation (EMA50 daily) | `main.js` + strategies | Alta |
| 9 | Scaled position sizing by confluence score (33/66/100%) | `simulator.js` | Alta |

> **OVERFITTING WARNING**: Never implement more than 2–3 of these simultaneously without separate in-sample + out-of-sample validation windows. `config.js` already documents this constraint.

---

### ⚙️ Critical Technical Constraints

1. **No lookahead bias**: All indicator and event data used at candle `i` must be computed only from candles `0..i-1`. The codebase enforces this via two-pointer pivot scanning and the `confirmedAt = p + bars` logic in `detectSwingLevels`.
2. **Parameter changes require re-validation**: Any change to `STRATEGY_PARAMS` or `STRATEGY2_PARAMS` must be backtested on the full live data window AND compared against a separate out-of-sample window before being kept.
3. **Binance CORS**: The app calls `api.binance.com` directly. No proxy is used. Yahoo Finance / yfinance was attempted for a third strategy (equities) but all free CORS proxies were blocked — Strategy 3 was switched to ETH/USDT on Binance instead.
4. **Strategy 3 (ETH/USDT)**: Uses the same `runEmaCrossStrategy` engine with `STRATEGY3_PARAMS` (EMA19/45, VWAP55). Results: 23 trades, 69.6% win rate, 30.51% return, 8.30% drawdown, PF 1.93. Confirmed stable across the neighborhood of nearby periods.
5. **Simulation model**: 1x cash-settled futures (no real leverage). Fee = 0.1% per side. Initial capital = $100 (for % return calculation).

---

## 🏛️ Clean Code & Architecture Standards

This section is **mandatory** for all future code contributions to the application. Every AI agent or human contributor must read and enforce these standards before writing or modifying any `.js` or `.html` file.

---

### 📐 Target Architecture (Component Model)

The codebase is organized in layered modules. Each layer may only depend on layers below it:

```
Layer 4 — App Bootstrap
  js/app/main.js             — Orquesta todo. Sin lógica de negocio ni de UI.

Layer 3 — UI Components (presentation only, no business logic)
  js/ui/strategy-view.js     — Tabs + resize per strategy view. Class: StrategyView.
  js/ui/metrics-panel.js     — Metric cards (Return, Win Rate, Drawdown, PF). Class: MetricsPanel.
  js/ui/signal-panel.js      — Live signal checklist panel. Class: SignalPanel.
  js/ui/trades-table.js      — Trade history table rendering. Class: TradesTable.
  js/ui/dom-utils.js         — Pure helpers: EVENT_LABELS, formatDate(), formatPrice(), CSS_CLASSES.

Layer 2 — Infrastructure / Rendering
  js/chart/chart-manager.js  — Generic chart wrapper. Class: ChartManager(containerId, options).
  js/data/live-feed.js       — WebSocket feed. Class: LiveFeed extends EventTarget.
  js/data/binance-api.js     — REST wrapper. Pure function: fetchBinanceKlines().

Layer 1 — Core (IMMUTABLE — pure functions, no side effects, no DOM)
  js/core/config.js          — Strategy parameters. NEVER touch without re-validation.
  js/core/indicators.js      — Pure math: ATR, VWAP, EMA, RSI, StochRSI, SwingLevels.
  js/core/simulator.js       — Pure backtest engine: runSimulator().
  js/core/strategy-wyckoff.js   — Pure strategy: runWyckoffUnifiedStrategy().
  js/core/strategy-emacross.js  — Pure strategy: runEmaCrossStrategy().
```

> **RULE**: Layer 1 (Core) files must NEVER import or reference any DOM, WebSocket, fetch, or UI concept. They receive data arrays and return result objects — nothing else.

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

### 🗂️ Architecture Refactor — Pending Implementation

A full refactor plan has been created and approved to eliminate the current technical debt. Key pending tasks:

| Task | Status | Files involved |
|---|---|---|
| Extract `ChartManager` class (replaces 3 copy-paste `renderCharts*` blocks) | ✅ Done | `charts.js` → `js/chart/chart-manager.js` |
| Extract `MetricsPanel` class (replaces `updateMetrics*` × 3) | ✅ Done | `ui.js` → `js/ui/metrics-panel.js` |
| Extract `SignalPanel` class (replaces `updateSignalPanel*` × 3) | ✅ Done | `ui.js` → `js/ui/signal-panel.js` |
| Extract `TradesTable` class (replaces `populateTradesTable*` × 3) | ✅ Done | `ui.js` → `js/ui/trades-table.js` |
| Extract `StrategyView` class (replaces `setupTabs` + `setupStrategySwitcher`) | ✅ Done | `ui.js` → `js/ui/strategy-view.js` |
| Extract `dom-utils.js` (CSS_CLASSES, EVENT_LABELS, formatDate, formatPrice) | ✅ Done | `ui.js` → `js/ui/dom-utils.js` |
| Refactor `LiveFeed` as `EventTarget` class (eliminates cross-file coupling) | ✅ Done | `live-feed.js` → `js/data/live-feed.js` |
| Refactor `main.js` as pure orchestrator | ✅ Done | `main.js` → `js/app/main.js` |
| Add semantic HTML (`<main>`, `<nav>`, `<aside>`, `<section>`, ARIA roles) | ✅ Done | `index.html` |
| Consolidate all `window.addEventListener('resize')` → single `ResizeObserver` | ✅ Done | `charts.js` (currently 3 listeners) |
| Add `CSS_CLASSES` token object (eliminate hardcoded class strings in JS) | ✅ Done | `ui.js`, `live-feed.js` |

**When implementing**: Do one task at a time. After each task, verify the app loads and metrics are unchanged before proceeding. Mark tasks `✅ Done` in this table when complete.
