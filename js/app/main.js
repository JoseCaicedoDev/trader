// App Bootstrap and Orchestrator
// Layer 4 (Application Bootstrap)
//
// Wires up all Layer 2 (Infrastructure) and Layer 3 (UI Presentation) components,
// orchestrates initial backtests, handles live WebSocket events, and updates UI state.
// Dynamically generates views from HTML5 template based on STRATEGIES_CONFIG.

const STRATEGIES_CONFIG = [
  {
    key: 'wyckoff',
    title: 'Wyckoff Unificada',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    accentColor: 'cyan',
    iconSvg: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    isEthTimeframe: false,
    strategyType: 'wyckoff',
    strategyParams: STRATEGY_PARAMS,
    runStrategy: runWyckoffUnifiedStrategy,
    showStochastic: true,
    emaFastLabel: STRATEGY_PARAMS.ema21Period,
    emaSlowLabel: STRATEGY_PARAMS.ema50Period,
    description: null
  },
  {
    // VWAP + EMA-cross engine on the 2h timeframe with its own EMA pair (12/60),
    // its own calibration and re-entry enabled — a separate view whose purpose is trade frequency,
    // not better risk. See the STRATEGY4_PARAMS comment in config.js before reading into its metrics.
    key: 'emacross2h',
    title: 'VWAP + Cruce EMA 12/60 — 2h',
    symbol: 'BTCUSDT',
    timeframe: '2h',
    accentColor: 'purple',
    iconSvg: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    isEthTimeframe: false,
    strategyType: 'emacross',
    strategyParams: STRATEGY4_PARAMS,
    runStrategy: runEmaCrossStrategy,
    showStochastic: false,
    // Roughly 3,000 2h candles from 1 January instead of Binance's default 1,000.
    // This applies only to the 12/60 view, so the other panels retain their
    // deliberately calibrated 1,000-candle windows.
    historyStart: Date.UTC(new Date().getUTCFullYear(), 0, 1),
    emaFastLabel: STRATEGY4_PARAMS.emaFast,
    emaSlowLabel: STRATEGY4_PARAMS.emaSlow
  },
  {
    // LONG on RSI dips below 25 inside a rising VWAP(1000) trend; exit selectable in the tab.
    key: 'rsi',
    title: 'RSI + VWAP — BTC 4h',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    accentColor: 'purple',
    iconSvg: '<path d="M3 7h18"/><path d="M3 17h18"/><path d="m3 14 4-6 4 5 4-7 6 9"/>',
    isEthTimeframe: false,
    strategyType: 'rsi',
    strategyParams: RSI_STRATEGY_PARAMS,
    runStrategy: runRsiZoneStrategy,
    showStochastic: false,
    showRsi: true,
    historyStart: RSI_HISTORY_START
  }
];

// RSI + MACD tab: indicators only (no backtest). One row per asset, one card per interval.
// `decimals` sizes the MACD numbers to each asset's price scale (XRP's histogram can be
// ~0.00003); `priceDecimals` keeps prices unambiguous in es locale ($92,11, not $92,107).
// HYPE reads the USDⓈ-M perpetual: its spot listing is too new for weekly/daily history.
const MOMENTUM_ASSETS = [
  { symbol: 'BTCUSDT', label: 'BTC', decimals: 1, priceDecimals: 0, market: 'spot' },
  { symbol: 'ETHUSDT', label: 'ETH', decimals: 2, priceDecimals: 2, market: 'spot' },
  { symbol: 'HYPEUSDT', label: 'HYPE', decimals: 3, priceDecimals: 2, market: 'futures', note: 'Futuros perpetuos (Binance)' },
  { symbol: 'SOLUSDT', label: 'SOL', decimals: 2, priceDecimals: 2, market: 'spot' },
  { symbol: 'XRPUSDT', label: 'XRP', decimals: 5, priceDecimals: 4, market: 'spot' }
];
const MOMENTUM_TIMEFRAMES = [
  { interval: '15m', label: '15 min' },
  { interval: '1h', label: '1 H' },
  { interval: '2h', label: '2 H' },
  { interval: '4h', label: '4 H', divergence: true },
  { interval: '12h', label: '12 H', divergence: true },
  { interval: '1d', label: '1 D', divergence: true },
  { interval: '1w', label: '1 S' }
];
const MOMENTUM_REFRESH_MS = 15 * 1000;

const views = {};
const feeds = {};

window.addEventListener('DOMContentLoaded', async () => {
  const appContainer = document.getElementById('app-container');
  const template = document.getElementById('strategy-view-template');

  if (!appContainer || !template) {
    console.error('El contenedor de la aplicación o la plantilla no se encontraron.');
    return;
  }

  // 1. Build and Mount Strategy Views from HTML5 Template
  STRATEGIES_CONFIG.forEach(config => {
    const clone = template.content.cloneNode(true);
    const root = clone.querySelector('.strategy-view');

    root.id = `strategy-view-${config.key}`;

    // Set title and colors
    const titleEl = root.querySelector('.strategy-title');
    titleEl.textContent = config.title;
    titleEl.classList.add(config.accentColor === 'cyan' ? 'from-white' : 'from-white');
    titleEl.classList.add(config.accentColor === 'cyan' ? 'via-gray-100' : 'via-gray-100');
    titleEl.classList.add(config.accentColor === 'cyan' ? 'to-neon-cyan' : 'to-neon-purple');

    // Customize icon
    const iconEl = root.querySelector('.strategy-icon');
    iconEl.innerHTML = config.iconSvg;
    iconEl.classList.add(config.accentColor === 'cyan' ? 'text-neon-cyan' : 'text-neon-purple');
    iconEl.classList.add(config.accentColor === 'cyan' ? 'drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]' : 'drop-shadow-[0_0_8px_rgba(179,136,255,0.6)]');

    // Price badge label
    const priceBadgeLabel = root.querySelector('.live-price-label');
    priceBadgeLabel.textContent = `${config.symbol.replace('USDT', '')}/USDT en vivo`;



    // Toggle specific strategy sections
    if (config.showStochastic) {
      root.querySelector('.chk-stoch-row').classList.remove('hidden');
      root.querySelector('.signal-event-badge').classList.remove('hidden');
    }
    if (config.showRsi) {
      root.querySelector('.chk-rsi-row').classList.remove('hidden');
      root.querySelector('.rsi-analysis').classList.remove('hidden');
      root.querySelector('.chk-ema-row').classList.add('hidden');
      root.querySelector('.lower-chart-wrap').classList.remove('hidden');
      // The price chart normally fills the panel on desktop; share the height with the RSI chart.
      root.querySelector('.main-chart').classList.replace('lg:h-full', 'lg:h-[46dvh]');
      root.querySelector('.lower-chart').classList.add('lg:h-[22dvh]');
      // Stack the rows from the top: a stretched middle row would push the RSI chart to the bottom
      // of a panel that grows with the (taller) sidebar, i.e. off screen.
      const chartPanel = root.querySelector('section[data-tab-panel="chart"]');
      chartPanel.classList.replace('grid-rows-[auto_1fr_auto]', 'grid-rows-[auto_auto_auto]');
      chartPanel.classList.add('content-start');
    }



    // Set tab border accent colors
    const tabBtns = root.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      if (btn.dataset.tab === 'chart') {
        btn.classList.add(config.accentColor === 'cyan' ? 'border-neon-cyan' : 'border-neon-purple');
      }
    });

    // Spinner color accent
    const spinnerEl = root.querySelector('.overlay-spinner');
    spinnerEl.className = `overlay-spinner w-10 h-10 border-3 ${config.accentColor === 'cyan' ? 'border-neon-cyan/10 border-t-neon-cyan' : 'border-neon-purple/10 border-t-neon-purple'} rounded-full animate-spin`;

    // Append to DOM
    appContainer.appendChild(clone);

    // Retrieve mounted root element to bind classes correctly
    const domRoot = document.getElementById(root.id);

    // Instantiate Layer 2/3 managers relative to the newly added view root
    const chartManager = new ChartManager(
      domRoot.querySelector('.main-chart'),
      domRoot.querySelector('.equity-chart'),
      config.accentColor === 'cyan' ? '#00e5ff' : '#b388ff',
      EVENT_LABELS,
      config.showRsi ? domRoot.querySelector('.lower-chart') : null
    );

    const metricsPanel = new MetricsPanel(domRoot);
    const signalPanel = new SignalPanel(domRoot, {
      emaFastLabel: config.emaFastLabel,
      emaSlowLabel: config.emaSlowLabel,
      priceDecimals: config.isEthTimeframe ? 2 : 0
    });
    const tradesTable = new TradesTable(domRoot);

    const strategyView = new StrategyView(domRoot, chartManager, config.accentColor);

    views[config.key] = {
      config,
      root: domRoot,
      chartManager,
      metricsPanel,
      signalPanel,
      tradesTable,
      strategyView,
      accentColor: config.accentColor,
      lastCandles: null,
      isRunning: false,
      lastUpdate: 0
    };
  });

  if (views.rsi) initRsiExitSelector(views.rsi);

  // 2. Initialize top-level strategy views switcher
  const switcherMap = {};
  Object.keys(views).forEach(k => {
    switcherMap[k] = views[k].strategyView;
  });
  const momentumView = createMomentumView();
  if (momentumView) switcherMap.momentum = momentumView;
  StrategyView.initStrategySwitcher(switcherMap);

  // 3. Initialize alert manager bindings for all newly generated checkbox and button classes
  initAlertManager();

  // 4. Run Initial Backtests (the momentum tab loads in parallel and refreshes on its own timer)
  if (momentumView) {
    refreshMomentumView(momentumView);
    setInterval(() => refreshMomentumView(momentumView), MOMENTUM_REFRESH_MS);
  }
  await Promise.all(STRATEGIES_CONFIG.map(config => runBacktestFlow(config.key)));

  // 5. Connect WebSocket Feeds. One feed per (symbol, timeframe) pair — views that share both share
  // a socket.
  setupLiveFeed('BTCUSDT', '4h', ['wyckoff', 'rsi']);
  setupLiveFeed('BTCUSDT', '2h', ['emacross2h']);
});

// Generic Backtest Flow Runner
async function runBacktestFlow(key) {
  const view = views[key];
  if (!view || view.isRunning) return;
  view.isRunning = true;

  try {
    view.metricsPanel.setLoading(true, 'Conectando con Binance API...');

    const rawData = view.config.historyStart
      ? await fetchBinanceKlinesSince(view.config.symbol, view.config.timeframe, view.config.historyStart)
      : await fetchBinanceKlines(view.config.symbol, view.config.timeframe, 1000);
    if (!rawData || rawData.length === 0) {
      throw new Error('No se recibieron datos de la API de Binance.');
    }

    view.metricsPanel.setLoading(true, 'Calculando indicadores y ejecutando estrategia...');

    const candles = rawData.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));
    candles.sort((a, b) => a.time - b.time);
    view.lastCandles = candles;

    renderBacktest(view, candles);

    view.metricsPanel.setLoading(false);
  } catch (error) {
    console.error(error);
    view.metricsPanel.setLoading(false);
    view.metricsPanel.setError(error.message);
  } finally {
    view.isRunning = false;
  }
}

// Exit-rule switch on the RSI view. The choice is remembered per browser and re-runs the backtest on
// the candles already loaded, so switching does not hit the Binance API again.
const RSI_EXIT_STORAGE_KEY = 'rsiExitMode';
const RSI_EXIT_BTN_ACTIVE = 'rsi-exit-btn text-[11px] font-semibold px-2 py-1.5 rounded-lg border transition-colors bg-neon-purple/15 text-neon-purple border-neon-purple/40';
const RSI_EXIT_BTN_IDLE = 'rsi-exit-btn text-[11px] font-semibold px-2 py-1.5 rounded-lg border transition-colors bg-white/5 text-gray-400 border-white/8 hover:text-gray-200';

// One radio-style button group per strategy parameter (entry mode, exit mode).
const RSI_SELECTORS = [
  { param: 'exitMode', storageKey: RSI_EXIT_STORAGE_KEY, selector: '.rsi-exit-btn', dataKey: 'exitMode', values: ['vwap', 'rsi'] },
  { param: 'entryMode', storageKey: 'rsiEntryMode', selector: '.rsi-entry-btn', dataKey: 'entryMode', values: ['scaled', 'single'] }
];

function initRsiExitSelector(view) {
  const params = view.config.strategyParams;
  RSI_SELECTORS.forEach(sel => {
    try {
      const saved = localStorage.getItem(sel.storageKey);
      if (sel.values.includes(saved)) params[sel.param] = saved;
    } catch (e) { /* storage unavailable: keep the default */ }

    const buttons = view.root.querySelectorAll(sel.selector);
    const base = sel.selector.slice(1);
    const paint = () => buttons.forEach(b => {
      const active = b.dataset[sel.dataKey] === params[sel.param];
      b.className = (active ? RSI_EXIT_BTN_ACTIVE : RSI_EXIT_BTN_IDLE).replace('rsi-exit-btn', base);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(active));
    });
    paint();

    buttons.forEach(b => b.addEventListener('click', () => {
      if (b.dataset[sel.dataKey] === params[sel.param]) return;
      params[sel.param] = b.dataset[sel.dataKey];
      try { localStorage.setItem(sel.storageKey, params[sel.param]); } catch (e) { /* ignore */ }
      paint();
      if (view.lastCandles && !view.isRunning) renderBacktest(view, view.lastCandles);
    }));
  });
}

// Runs the strategy on already-loaded candles and refreshes every panel of the view.
function renderBacktest(view, candles) {
  const res = view.config.runStrategy(candles, view.config.strategyParams, INITIAL_CAPITAL, FEE_PERCENT);
  view.chartManager.render(candles, res);
  view.metricsPanel.update(res, INITIAL_CAPITAL);
  view.tradesTable.render(res.trades, res.eventLabels);
  view.signalPanel.update(res.currentState);
  if (res.rsiStats) renderRsiAnalysis(view.root, res.rsiStats);
  const lowerTitle = view.root.querySelector('.lower-chart-title');
  if (lowerTitle && view.config.showRsi) {
    const p = view.config.strategyParams;
    const buy = p.entryMode === 'scaled' ? `compra ½ < ${p.scaleLevels[0]} y ½ < ${p.scaleLevels[1]}` : `compra < ${p.entryLevel}`;
    lowerTitle.textContent = `RSI (${p.rsiPeriod}) · ${buy} · venta > ${p.exitMode === 'rsi' ? p.exitRsi : p.exitRsiCap}` +
      (p.exitMode === 'vwap' ? ` o precio > VWAP${p.exitVwapPeriod}` : '');
  }
  return res;
}

// Fills the RSI view's "last year" card: how often each zone was reached and how the trades closed.
function renderRsiAnalysis(root, s) {
  const fmtDate = t => new Date(t * 1000).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
  const pct = v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  const colored = v => `<span class="${v >= 0 ? 'text-neon-emerald' : 'text-neon-rose'} font-semibold">${pct(v)}</span>`;
  const closed = s.winners + s.losers;

  root.querySelector('.rsi-range').textContent = s.from
    ? `${fmtDate(s.from)} → ${fmtDate(s.to)} · ${s.candles} velas de 4h`
    : 'Sin datos suficientes';
  root.querySelector('.rsi-ob-count').textContent = s.overboughtEvents;
  root.querySelector('.rsi-ob-pct').textContent = `veces · ${s.pctOverbought.toFixed(1)}% del tiempo`;
  root.querySelector('.rsi-os-count').textContent = s.oversoldEvents;
  root.querySelector('.rsi-os-pct').textContent = `veces · ${s.pctOversold.toFixed(1)}% del tiempo`;
  root.querySelector('.rsi-trade-summary').innerHTML = closed === 0
    ? 'Ninguna operación cerrada en el periodo.'
    : `<span class="text-white font-semibold">${s.winners} de ${closed}</span> ${s.entryMode === 'scaled' ? 'tramos (½ capital cada uno) cerrados' : 'operaciones cerradas'} en positivo<br>` +
      `Ganancia media ${s.winners ? colored(s.avgWinPct) : '—'} · Pérdida media ${s.losers ? colored(s.avgLossPct) : 'ninguna'}<br>` +
      `Mejor ${colored(s.bestPct)} · Peor ${colored(s.worstPct)}<br>` +
      `Comprar y mantener BTC en el mismo periodo: ${colored(s.buyHoldPct)}`;
}

// Live WebSocket feed manager
function setupLiveFeed(symbol, timeframe, configKeys) {
  const feed = new LiveFeed(symbol, timeframe);
  feeds[`${symbol}-${timeframe}`] = feed;

  feed.addEventListener('open', () => {
    const activeClass = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse';
    configKeys.forEach(key => {
      const view = views[key];
      if (view) {
        const dot = view.root.querySelector('.live-price-dot');
        if (dot) dot.className = activeClass;
      }
    });
  });

  feed.addEventListener('price', (e) => {
    const kline = e.detail;
    const priceStr = '$' + formatPrice(kline.close, symbol === 'ETHUSDT' ? 2 : 0);

    configKeys.forEach(key => {
      const view = views[key];
      if (!view) return;

      // Update chart live candle
      view.chartManager.updateLiveCandle(kline);

      // Update price display badge
      const valEl = view.root.querySelector('.live-price-value');
      if (valEl) valEl.textContent = priceStr;

      // Throttle signal updates to 1.5s
      const now = Date.now();
      if (now - view.lastUpdate < 1500) return;
      view.lastUpdate = now;

      if (view.lastCandles && !view.isRunning) {
        const tempCandles = [...view.lastCandles, kline];
        const res = view.config.runStrategy(tempCandles, view.config.strategyParams, INITIAL_CAPITAL, FEE_PERCENT);
        view.signalPanel.update(res.currentState);

        const sigDot = view.root.querySelector('.signal-live-dot');
        if (sigDot) {
          sigDot.className = view.config.accentColor === 'cyan'
            ? CSS_CLASSES.DOT_SIGNAL_ACTIVE_WYCKOFF
            : CSS_CLASSES.DOT_SIGNAL_ACTIVE_CROSS;
        }

        if (res.currentState.signal) {
          const eventType = view.config.strategyType === 'wyckoff'
            ? res.currentState.lastEvent
            : view.config.strategyType === 'rsi'
              ? EVENT_LABELS.RSI_DIP_BUY
              : (res.currentState.signal === 'BUY' ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN');
          checkAndTriggerAlert(symbol, key, res.currentState.price, res.currentState.signal, kline.time, eventType);
        }
      }
    });
  });

  feed.addEventListener('candleClose', () => {
    configKeys.forEach(key => {
      runBacktestFlow(key);
    });
  });

  feed.addEventListener('close', () => {
    configKeys.forEach(key => {
      const view = views[key];
      if (view) {
        const dot = view.root.querySelector('.live-price-dot');
        if (dot) dot.className = CSS_CLASSES.DOT_LIVE_NEUTRAL;
      }
    });
  });

  feed.addEventListener('error', () => {
    configKeys.forEach(key => {
      const view = views[key];
      if (view) {
        const dot = view.root.querySelector('.live-price-dot');
        if (dot) dot.className = CSS_CLASSES.DOT_LIVE_ERROR;
        view.metricsPanel.setError(`Se perdió la conexión en vivo con ${symbol}. Reintentando...`);
      }
    });
  });

  feed.connect();
}

// The switcher only needs `root`, `accentColor` and a `chartManager` exposing resize(),
// so MomentumView plugs in as its own chartManager without touching StrategyView.
function createMomentumView() {
  const root = document.getElementById('momentum-view');
  if (!root) return null;
  const view = new MomentumView(root, MOMENTUM_ASSETS, MOMENTUM_TIMEFRAMES);
  return { root, accentColor: view.accentColor, chartManager: view, momentumView: view };
}

// Assets load independently so one failing symbol only blanks its own row.
async function refreshMomentumView({ momentumView }) {
  const results = await Promise.allSettled(MOMENTUM_ASSETS.map(asset => refreshMomentumAsset(momentumView, asset)));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed === 0) {
    momentumView.setStatus(`Actualizado ${new Date().toLocaleTimeString()} · incluye la vela en curso`);
  } else {
    momentumView.setStatus(`${failed} activo(s) no se pudieron cargar — reintentando en 15 s`, true);
  }
}

async function refreshMomentumAsset(momentumView, asset) {
  const fetchKlines = asset.market === 'futures' ? fetchBinanceFuturesKlines : fetchBinanceKlines;
  try {
    const entries = await Promise.all(MOMENTUM_TIMEFRAMES.map(async tf => {
      const raw = await fetchKlines(asset.symbol, tf.interval, 500);
      return [tf.interval, buildMomentumSnapshot(raw, tf.divergence)];
    }));
    momentumView.updateAsset(asset.symbol, Object.fromEntries(entries));
  } catch (error) {
    console.error(error);
    momentumView.setAssetError(asset.symbol, `Error al cargar ${asset.label}: ${error.message}`);
    throw error;
  }
}

// Divergences are read on closed candles only (the forming one is dropped), so a mark doesn't
// flicker in and out while the current candle is still moving.
function buildMomentumSnapshot(rawKlines, withDivergence = false) {
  const candles = rawKlines.map(k => ({
    time: Math.floor(k[0] / 1000),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4])
  }));
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const closed = candles.length - 1;
  return {
    rsi,
    macd,
    lastClose: candles[closed].close,
    divergences: withDivergence
      ? detectDivergences(candles.slice(0, closed), { RSI: rsi.slice(0, closed), MACD: macd.macd.slice(0, closed) })
      : null
  };
}
