// UI Rendering Module: overlays, metric cards, signal panels, trade history table, and the two tab
// systems (chart/equity/history sub-tabs, and the 3-way strategy switcher).
//
// Depends on: charts.js (priceChartInstance/2/3, equityChartInstance/2/3, for resize-on-tab-show).
// Must load after charts.js and before main.js.

// Overlay elements
const mainOverlay = document.getElementById('main-overlay');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Metrics elements
const returnMetric = document.getElementById('metric-return');
const winrateMetric = document.getElementById('metric-winrate');
const tradesMetric = document.getElementById('metric-trades');
const drawdownMetric = document.getElementById('metric-drawdown');
const factorMetric = document.getElementById('metric-factor');

// Trades body
const tradesTableBody = document.getElementById('trades-table-body');

// Strategy 2 (VWAP + EMA Cross) DOM elements
const mainOverlay2 = document.getElementById('main-overlay-2');
const statusDot2 = document.getElementById('status-dot-2');
const statusText2 = document.getElementById('status-text-2');
const returnMetric2 = document.getElementById('metric-return-2');
const winrateMetric2 = document.getElementById('metric-winrate-2');
const tradesMetric2 = document.getElementById('metric-trades-2');
const drawdownMetric2 = document.getElementById('metric-drawdown-2');
const factorMetric2 = document.getElementById('metric-factor-2');
const tradesTableBody2 = document.getElementById('trades-table-body-2');

// Strategy 3 (VWAP + EMA Cross, ETH/USDT) DOM elements
const mainOverlay3 = document.getElementById('main-overlay-3');
const statusDot3 = document.getElementById('status-dot-3');
const statusText3 = document.getElementById('status-text-3');
const returnMetric3 = document.getElementById('metric-return-3');
const winrateMetric3 = document.getElementById('metric-winrate-3');
const tradesMetric3 = document.getElementById('metric-trades-3');
const drawdownMetric3 = document.getElementById('metric-drawdown-3');
const factorMetric3 = document.getElementById('metric-factor-3');
const tradesTableBody3 = document.getElementById('trades-table-body-3');

// isBacktestRunning is the shared concurrency guard: set here (both strategies run within one
// runBacktestFlow() call in main.js), read by live-feed.js to decide whether to trigger a refresh
// or just update the live signal panels.
let isBacktestRunning = false;

// Tabs: Gráfico de Precios / Equity Curve / Historial de Operaciones, scoped to a given strategy
// view's root element so the two strategy views' tab groups never cross-fire. Only one panel is
// visible at a time so the price chart isn't squeezed by the other two sections. Lightweight Charts
// sizes itself off the container's clientWidth/clientHeight at creation time, which is 0 while a
// panel is display:none — so charts hidden on initial load must be explicitly resized once their
// tab is shown for the first time (handled by the caller-supplied onShow callback).
function setupTabs(root, onShow) {
  const tabButtons = root.querySelectorAll('.tab-btn');
  const panels = root.querySelectorAll('[data-tab-panel]');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;

      tabButtons.forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('border-neon-cyan', isActive);
        b.classList.toggle('border-neon-purple', isActive && root.id === 'strategy-view-emacross');
        b.classList.toggle('text-white', isActive);
        b.classList.toggle('border-transparent', !isActive);
        b.classList.toggle('text-gray-400', !isActive);
      });

      panels.forEach(panel => {
        const isTarget = panel.dataset.tabPanel === target;
        panel.classList.toggle('hidden', !isTarget);
        panel.classList.toggle('flex', isTarget);
      });

      if (onShow) onShow(target);
    });
  });
}

// Strategy Switcher: toggles between the Wyckoff-unified view and the VWAP+EMA Cross reference
// view. Both charts are rendered on load (they share one fetched dataset), so switching is instant
// — it just needs to resize the newly-shown chart since it may have been created while hidden
// (display:none containers report 0 clientWidth/Height to Lightweight Charts).
function setupStrategySwitcher() {
  const buttons = document.querySelectorAll('.strategy-tab-btn');
  const views = {
    wyckoff: document.getElementById('strategy-view-wyckoff'),
    emacross: document.getElementById('strategy-view-emacross'),
    eth: document.getElementById('strategy-view-eth')
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.strategy;

      buttons.forEach(b => {
        const isActive = b.dataset.strategy === target;
        b.className = 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors ' +
          (isActive
            ? (target === 'wyckoff'
              ? 'bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25 active-strategy-tab'
              : 'bg-neon-purple/15 text-neon-purple border border-neon-purple/25 active-strategy-tab')
            : 'bg-white/5 text-gray-400 border border-white/8 hover:text-gray-200');
      });

      Object.entries(views).forEach(([key, el]) => {
        el.classList.toggle('hidden', key !== target);
        el.classList.toggle('flex', key === target);
      });

      if (target === 'wyckoff' && priceChartInstance) {
        const el = document.getElementById('main-chart');
        priceChartInstance.resize(el.clientWidth, el.clientHeight);
      } else if (target === 'emacross' && priceChartInstance2) {
        const el = document.getElementById('main-chart-2');
        priceChartInstance2.resize(el.clientWidth, el.clientHeight);
      } else if (target === 'eth' && priceChartInstance3) {
        const el = document.getElementById('main-chart-3');
        priceChartInstance3.resize(el.clientWidth, el.clientHeight);
      }
    });
  });
}

// UI State Management Helpers using Tailwind CSS Classes
function setLoadingState(isLoading, message = 'Procesando...') {
  isBacktestRunning = isLoading;
  if (isLoading) {
    mainOverlay.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('overlay-message').textContent = message;
    statusDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-purple shadow-[0_0_8px_#b388ff] animate-pulse';
    statusText.textContent = 'Procesando...';
  } else {
    mainOverlay.classList.add('opacity-0', 'pointer-events-none');
    statusDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_8px_#00e676]';
    statusText.textContent = 'API de Binance activa';
  }
}

function setErrorState(errorMessage) {
  statusDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-rose shadow-[0_0_8px_#ff1744]';
  statusText.textContent = 'Error: ' + errorMessage;
  alert('Error en backtesting:\n' + errorMessage);
}

// Mirror of setLoadingState for the second (VWAP + EMA Cross) view. Doesn't touch isBacktestRunning
// — both strategies run within the same runBacktestFlow() call, so the concurrency guard is shared.
function setLoadingState2(isLoading, message = 'Procesando...') {
  if (!mainOverlay2) return;
  if (isLoading) {
    mainOverlay2.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('overlay-message-2').textContent = message;
    if (statusDot2) statusDot2.className = 'w-2 h-2 rounded-full inline-block bg-neon-purple shadow-[0_0_8px_#b388ff] animate-pulse';
    if (statusText2) statusText2.textContent = 'Procesando...';
  } else {
    mainOverlay2.classList.add('opacity-0', 'pointer-events-none');
    if (statusDot2) statusDot2.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_8px_#00e676]';
    if (statusText2) statusText2.textContent = 'API de Binance activa';
  }
}

// Mirror of setLoadingState2 for the third (VWAP + EMA Cross, ETH/USDT) view.
function setLoadingState3(isLoading, message = 'Procesando...') {
  if (!mainOverlay3) return;
  if (isLoading) {
    mainOverlay3.classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('overlay-message-3').textContent = message;
    if (statusDot3) statusDot3.className = 'w-2 h-2 rounded-full inline-block bg-neon-purple shadow-[0_0_8px_#b388ff] animate-pulse';
    if (statusText3) statusText3.textContent = 'Procesando...';
  } else {
    mainOverlay3.classList.add('opacity-0', 'pointer-events-none');
    if (statusDot3) statusDot3.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_8px_#00e676]';
    if (statusText3) statusText3.textContent = 'API de Binance activa';
  }
}

// Live Signal Panel: renders the plain-language checklist from backtestResults.currentState so the
// user can see exactly which entry conditions are true on the last closed candle, and the live
// SL/TP/unrealized P&L if a position is currently open.
function updateSignalPanel(state) {
  if (!state) return;
  const okDot = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shrink-0';
  const badDot = 'w-2 h-2 rounded-full inline-block bg-neon-rose shrink-0';
  const neutralDot = 'w-2 h-2 rounded-full inline-block bg-gray-600 shrink-0';

  // Wyckoff event badge
  const eventBadge = document.getElementById('signal-event-badge');
  if (state.lastEvent) {
    eventBadge.textContent = 'Evento detectado: ' + (EVENT_LABELS[state.lastEvent] || state.lastEvent);
    eventBadge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/20';
  } else {
    eventBadge.textContent = 'Sin evento Wyckoff activo';
    eventBadge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/8';
  }

  // VWAP check
  const vwapDot = document.getElementById('chk-vwap-dot');
  const vwapText = document.getElementById('chk-vwap-text');
  if (state.vwap !== null) {
    vwapDot.className = state.aboveVwap ? okDot : badDot;
    vwapText.textContent = (state.aboveVwap ? 'Precio arriba (alcista)' : 'Precio abajo (bajista)') +
      ' — $' + state.vwap.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else {
    vwapDot.className = neutralDot;
    vwapText.textContent = 'Calculando...';
  }

  // EMA21/50 structure check
  const emaDot = document.getElementById('chk-ema-dot');
  const emaText = document.getElementById('chk-ema-text');
  if (state.bullishStructure !== null) {
    emaDot.className = state.bullishStructure ? okDot : badDot;
    emaText.textContent = state.bullishStructure ? 'Estructura alcista (21>50)' : 'Estructura bajista (21<50)';
  } else {
    emaDot.className = neutralDot;
    emaText.textContent = 'Calculando...';
  }

  // Stochastic RSI check
  const stochDot = document.getElementById('chk-stoch-dot');
  const stochText = document.getElementById('chk-stoch-text');
  if (state.stochK !== null) {
    const kStr = state.stochK.toFixed(0);
    if (state.stochOversold) {
      stochDot.className = okDot;
      stochText.textContent = 'Sobrevendido (%K=' + kStr + ')';
    } else if (state.stochOverbought) {
      stochDot.className = okDot;
      stochText.textContent = 'Sobrecomprado (%K=' + kStr + ')';
    } else {
      stochDot.className = neutralDot;
      stochText.textContent = 'Zona neutral (%K=' + kStr + ')';
    }
  } else {
    stochDot.className = neutralDot;
    stochText.textContent = 'Calculando...';
  }

  // Open position detail
  const posDot = document.getElementById('chk-position-dot');
  const posText = document.getElementById('chk-position-text');
  const posDetail = document.getElementById('signal-position-detail');
  if (state.openTrade) {
    const t = state.openTrade;
    posDot.className = t.unrealizedPct >= 0 ? okDot : badDot;
    posText.textContent = t.direction + (t.unrealizedPct >= 0 ? ' en ganancia' : ' en pérdida');
    posDetail.classList.remove('hidden');
    document.getElementById('pos-entry').textContent = '$' + t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('pos-sl').textContent = t.stopLoss !== null ? '$' + t.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    document.getElementById('pos-tp').textContent = t.takeProfit !== null ? '$' + t.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const pnlEl = document.getElementById('pos-pnl');
    pnlEl.textContent = (t.unrealizedPct >= 0 ? '+' : '') + t.unrealizedPct.toFixed(2) + '%';
    pnlEl.className = t.unrealizedPct >= 0 ? 'text-neon-emerald' : 'text-neon-rose';
  } else {
    posDot.className = neutralDot;
    posText.textContent = 'Sin posición';
    posDetail.classList.add('hidden');
  }
}

function updateMetrics(results, initialCapital) {
  const returnAmt = results.finalBalance - initialCapital;
  const returnPct = (returnAmt / initialCapital) * 100;

  // Return Metric Card
  returnMetric.textContent = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  returnMetric.className = 'text-2xl font-bold tracking-tight tabular-nums ' +
    (returnPct >= 0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  document.getElementById('metric-return-abs').textContent = `${returnAmt >= 0 ? '$' : '-$'}${Math.abs(returnAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de ganancias netas`;

  // Win Rate Metric Card (closing trades of either direction: SELL closes a long, COVER closes a short)
  const closingTrades = results.trades.filter(t => t.type === 'SELL' || t.type === 'COVER');
  const winningTrades = closingTrades.filter(t => t.pnl > 0);
  const winRate = closingTrades.length === 0 ? 0 : (winningTrades.length / closingTrades.length) * 100;
  winrateMetric.textContent = `${winRate.toFixed(1)}%`;
  winrateMetric.className = 'text-2xl font-bold tracking-tight tabular-nums ' +
    (winRate >= 50 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');

  // Total Trades completed card
  tradesMetric.textContent = results.totalTrades;

  // Max Drawdown card
  drawdownMetric.textContent = `-${results.maxDrawdown.toFixed(2)}%`;
  drawdownMetric.className = 'text-2xl font-bold tracking-tight tabular-nums text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]';

  // Profit Factor card
  const pfValue = results.profitFactor;
  if (pfValue === Infinity) {
    factorMetric.textContent = '∞';
    factorMetric.className = 'text-2xl font-bold tracking-tight tabular-nums text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]';
  } else {
    factorMetric.textContent = pfValue.toFixed(2);
    factorMetric.className = 'text-2xl font-bold tracking-tight tabular-nums ' +
      (pfValue >= 1.0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  }
}

// Simplified live signal panel for Strategy 2 (VWAP + EMA Cross) — just trend structure, VWAP
// position and the open position detail, since there's no Wyckoff event/Stochastic checklist here.
function updateSignalPanel2(state) {
  if (!state) return;
  const okDot = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shrink-0';
  const badDot = 'w-2 h-2 rounded-full inline-block bg-neon-rose shrink-0';
  const neutralDot = 'w-2 h-2 rounded-full inline-block bg-gray-600 shrink-0';

  const vwapDot = document.getElementById('chk-vwap-dot-2');
  const vwapText = document.getElementById('chk-vwap-text-2');
  if (state.vwap !== null) {
    vwapDot.className = state.aboveVwap ? okDot : badDot;
    vwapText.textContent = (state.aboveVwap ? 'Precio arriba (alcista)' : 'Precio abajo (bajista)') +
      ' — $' + state.vwap.toLocaleString(undefined, { maximumFractionDigits: 0 });
  } else {
    vwapDot.className = neutralDot;
    vwapText.textContent = 'Calculando...';
  }

  const emaDot = document.getElementById('chk-ema-dot-2');
  const emaText = document.getElementById('chk-ema-text-2');
  if (state.bullishStructure !== null) {
    emaDot.className = state.bullishStructure ? okDot : badDot;
    emaText.textContent = state.bullishStructure ? 'EMA21 > EMA30 (alcista)' : 'EMA21 < EMA30 (bajista)';
  } else {
    emaDot.className = neutralDot;
    emaText.textContent = 'Calculando...';
  }

  const posDot = document.getElementById('chk-position-dot-2');
  const posText = document.getElementById('chk-position-text-2');
  const posDetail = document.getElementById('signal-position-detail-2');
  if (state.openTrade) {
    const t = state.openTrade;
    posDot.className = t.unrealizedPct >= 0 ? okDot : badDot;
    posText.textContent = t.direction + (t.unrealizedPct >= 0 ? ' en ganancia' : ' en pérdida');
    posDetail.classList.remove('hidden');
    document.getElementById('pos-entry-2').textContent = '$' + t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('pos-sl-2').textContent = t.stopLoss !== null ? '$' + t.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    document.getElementById('pos-tp-2').textContent = t.takeProfit !== null ? '$' + t.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const pnlEl = document.getElementById('pos-pnl-2');
    pnlEl.textContent = (t.unrealizedPct >= 0 ? '+' : '') + t.unrealizedPct.toFixed(2) + '%';
    pnlEl.className = t.unrealizedPct >= 0 ? 'text-neon-emerald' : 'text-neon-rose';
  } else {
    posDot.className = neutralDot;
    posText.textContent = 'Sin posición';
    posDetail.classList.add('hidden');
  }
}

// Mirror of updateSignalPanel2 for Strategy 3 (ETH/USDT).
function updateSignalPanel3(state) {
  if (!state) return;
  const okDot = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shrink-0';
  const badDot = 'w-2 h-2 rounded-full inline-block bg-neon-rose shrink-0';
  const neutralDot = 'w-2 h-2 rounded-full inline-block bg-gray-600 shrink-0';

  const vwapDot = document.getElementById('chk-vwap-dot-3');
  const vwapText = document.getElementById('chk-vwap-text-3');
  if (state.vwap !== null) {
    vwapDot.className = state.aboveVwap ? okDot : badDot;
    vwapText.textContent = (state.aboveVwap ? 'Precio arriba (alcista)' : 'Precio abajo (bajista)') +
      ' — $' + state.vwap.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } else {
    vwapDot.className = neutralDot;
    vwapText.textContent = 'Calculando...';
  }

  const emaDot = document.getElementById('chk-ema-dot-3');
  const emaText = document.getElementById('chk-ema-text-3');
  if (state.bullishStructure !== null) {
    emaDot.className = state.bullishStructure ? okDot : badDot;
    emaText.textContent = state.bullishStructure ? 'EMA19 > EMA45 (alcista)' : 'EMA19 < EMA45 (bajista)';
  } else {
    emaDot.className = neutralDot;
    emaText.textContent = 'Calculando...';
  }

  const posDot = document.getElementById('chk-position-dot-3');
  const posText = document.getElementById('chk-position-text-3');
  const posDetail = document.getElementById('signal-position-detail-3');
  if (state.openTrade) {
    const t = state.openTrade;
    posDot.className = t.unrealizedPct >= 0 ? okDot : badDot;
    posText.textContent = t.direction + (t.unrealizedPct >= 0 ? ' en ganancia' : ' en pérdida');
    posDetail.classList.remove('hidden');
    document.getElementById('pos-entry-3').textContent = '$' + t.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('pos-sl-3').textContent = t.stopLoss !== null ? '$' + t.stopLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    document.getElementById('pos-tp-3').textContent = t.takeProfit !== null ? '$' + t.takeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const pnlEl = document.getElementById('pos-pnl-3');
    pnlEl.textContent = (t.unrealizedPct >= 0 ? '+' : '') + t.unrealizedPct.toFixed(2) + '%';
    pnlEl.className = t.unrealizedPct >= 0 ? 'text-neon-emerald' : 'text-neon-rose';
  } else {
    posDot.className = neutralDot;
    posText.textContent = 'Sin posición';
    posDetail.classList.add('hidden');
  }
}

// Mirror of updateMetrics for Strategy 2's sidebar metric cards.
function updateMetrics2(results, initialCapital) {
  const returnAmt = results.finalBalance - initialCapital;
  const returnPct = (returnAmt / initialCapital) * 100;

  returnMetric2.textContent = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  returnMetric2.className = 'text-xl font-bold tracking-tight tabular-nums ' +
    (returnPct >= 0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  document.getElementById('metric-return-abs-2').textContent = `${returnAmt >= 0 ? '$' : '-$'}${Math.abs(returnAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} netas`;

  const closingTrades = results.trades.filter(t => t.type === 'SELL' || t.type === 'COVER');
  const winningTrades = closingTrades.filter(t => t.pnl > 0);
  const winRate = closingTrades.length === 0 ? 0 : (winningTrades.length / closingTrades.length) * 100;
  winrateMetric2.textContent = `${winRate.toFixed(1)}%`;
  winrateMetric2.className = 'text-xl font-bold tracking-tight tabular-nums ' +
    (winRate >= 50 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');

  tradesMetric2.textContent = results.totalTrades;

  drawdownMetric2.textContent = `-${results.maxDrawdown.toFixed(2)}%`;
  drawdownMetric2.className = 'text-xl font-bold tracking-tight tabular-nums text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]';

  const pfValue = results.profitFactor;
  if (pfValue === Infinity) {
    factorMetric2.textContent = '∞';
    factorMetric2.className = 'text-xl font-bold tracking-tight tabular-nums text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]';
  } else {
    factorMetric2.textContent = pfValue.toFixed(2);
    factorMetric2.className = 'text-xl font-bold tracking-tight tabular-nums ' +
      (pfValue >= 1.0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  }
}

// Mirror of updateMetrics2 for Strategy 3's sidebar metric cards.
function updateMetrics3(results, initialCapital) {
  const returnAmt = results.finalBalance - initialCapital;
  const returnPct = (returnAmt / initialCapital) * 100;

  returnMetric3.textContent = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
  returnMetric3.className = 'text-xl font-bold tracking-tight tabular-nums ' +
    (returnPct >= 0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  document.getElementById('metric-return-abs-3').textContent = `${returnAmt >= 0 ? '$' : '-$'}${Math.abs(returnAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} netas`;

  const closingTrades = results.trades.filter(t => t.type === 'SELL' || t.type === 'COVER');
  const winningTrades = closingTrades.filter(t => t.pnl > 0);
  const winRate = closingTrades.length === 0 ? 0 : (winningTrades.length / closingTrades.length) * 100;
  winrateMetric3.textContent = `${winRate.toFixed(1)}%`;
  winrateMetric3.className = 'text-xl font-bold tracking-tight tabular-nums ' +
    (winRate >= 50 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');

  tradesMetric3.textContent = results.totalTrades;

  drawdownMetric3.textContent = `-${results.maxDrawdown.toFixed(2)}%`;
  drawdownMetric3.className = 'text-xl font-bold tracking-tight tabular-nums text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]';

  const pfValue = results.profitFactor;
  if (pfValue === Infinity) {
    factorMetric3.textContent = '∞';
    factorMetric3.className = 'text-xl font-bold tracking-tight tabular-nums text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]';
  } else {
    factorMetric3.textContent = pfValue.toFixed(2);
    factorMetric3.className = 'text-xl font-bold tracking-tight tabular-nums ' +
      (pfValue >= 1.0 ? 'text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]' : 'text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]');
  }
}

// Human-readable labels for the Wyckoff/momentum event codes used as entry/exit reasons.
const EVENT_LABELS = {
  SPRING: 'Spring', LPS: 'LPS', SOS: 'SOS', UTAD: 'UTAD', SOW: 'SOW', LPSY: 'LPSY',
  STOCH_EXIT: 'Cruce %K/%D', STOP_LOSS: 'Stop Loss', TAKE_PROFIT: 'Take Profit',
  EMA_CROSS_UP: 'Cruce Alcista EMA', EMA_CROSS_DOWN: 'Cruce Bajista EMA'
};

function formatDate(time) {
  return new Date(time * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Direction badge: LONG (opened by BUY, mirrors Spring/LPS) or SHORT (opened by SHORT, mirrors UTAD/LPSY)
function directionBadge(entryType) {
  return entryType === 'BUY'
    ? '<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/20">LONG</span>'
    : '<span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-rose/15 text-neon-rose border border-neon-rose/20">SHORT</span>';
}

// The engine emits one entry (BUY/SHORT) and one exit (SELL/COVER) per completed round trip
// (`trades` alternates entry, exit, entry, exit, ...), with an unmatched trailing entry if a
// position is still open when the backtest window ends. This pairs them into one row per trade so
// the table matches the "Transacciones" metric (completed round trips only) instead of showing
// every raw fill.
function populateTradesTable(trades, eventLabels) {
  populateTradesTableInto(tradesTableBody, trades, eventLabels);
}

// Strategy 2's trade history table — same rendering, different tbody target.
function populateTradesTable2(trades, eventLabels) {
  populateTradesTableInto(tradesTableBody2, trades, eventLabels);
}

// Strategy 3's trade history table — same rendering, different tbody target.
function populateTradesTable3(trades, eventLabels) {
  populateTradesTableInto(tradesTableBody3, trades, eventLabels);
}

function populateTradesTableInto(tbody, trades, eventLabels) {
  tbody.innerHTML = '';

  if (trades.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center text-gray-500 py-8">
          No se ejecutaron transacciones con los parámetros dados.
        </td>
      </tr>
    `;
    return;
  }

  const roundTrips = [];
  let openEntry = null;
  trades.forEach(t => {
    if (t.type === 'BUY' || t.type === 'SHORT') {
      openEntry = t;
    } else if (openEntry) {
      roundTrips.push({ entry: openEntry, exit: t });
      openEntry = null;
    }
  });

  // Newest first
  const rows = [...roundTrips].reverse();
  if (openEntry) rows.unshift({ entry: openEntry, exit: null });

  rows.forEach(({ entry, exit }) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-white/5 hover:bg-white/2 transition-colors duration-150';

    const entryEventLabel = EVENT_LABELS[eventLabels[entry.index]] || eventLabels[entry.index] || '-';

    if (!exit) {
      row.innerHTML = `
        <td class="p-3">${directionBadge(entry.type)}</td>
        <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
        <td class="p-3"><span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-purple/15 text-neon-purple border border-neon-purple/20">${entryEventLabel}</span></td>
        <td class="p-3 text-gray-300 font-mono">$${entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="p-3 text-gray-500" colspan="3">Posición abierta (aún sin cerrar)</td>
        <td class="p-3 text-gray-500">-</td>
        <td class="p-3 text-gray-300 font-mono">-</td>
      `;
      tbody.appendChild(row);
      return;
    }

    const exitEventLabel = EVENT_LABELS[eventLabels[exit.index]] || eventLabels[exit.index] || '-';
    const sign = exit.pnl >= 0 ? '+' : '';
    const pnlCell = `${sign}$${exit.pnl.toFixed(2)} (${sign}${exit.pnlPercent.toFixed(2)}%)`;
    const pnlClass = 'p-3 font-semibold font-mono ' + (exit.pnl >= 0 ? 'text-neon-emerald' : 'text-neon-rose');
    const exitBadgeClass = exit.pnl >= 0
      ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/20'
      : 'bg-neon-rose/15 text-neon-rose border-neon-rose/20';

    row.innerHTML = `
      <td class="p-3">${directionBadge(entry.type)}</td>
      <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
      <td class="p-3"><span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-purple/15 text-neon-purple border border-neon-purple/20">${entryEventLabel}</span></td>
      <td class="p-3 text-gray-300 font-mono">$${entry.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="p-3 text-gray-300">${formatDate(exit.time)}</td>
      <td class="p-3"><span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center border ${exitBadgeClass}">${exitEventLabel}</span></td>
      <td class="p-3 text-gray-300 font-mono">$${exit.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td class="${pnlClass}">${pnlCell}</td>
      <td class="p-3 text-gray-300 font-mono">$${exit.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    `;

    tbody.appendChild(row);
  });
}
