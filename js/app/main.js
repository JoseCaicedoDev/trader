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
    description: null
  },
  {
    key: 'emacross',
    title: 'VWAP + Cruce EMA 21/30',
    symbol: 'BTCUSDT',
    timeframe: '4h',
    accentColor: 'purple',
    iconSvg: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    isEthTimeframe: false,
    strategyType: 'emacross',
    strategyParams: STRATEGY2_PARAMS,
    runStrategy: runEmaCrossStrategy,
    showStochastic: false,
    description: 'Estrategia de referencia más simple: entra cuando EMA21, EMA30 y VWAP quedan alineadas (las 3 líneas cruzándose entre sí) y mantiene la posición hasta el cruce opuesto o el SL/TP, sin estructura Wyckoff. Validada sobre los mismos datos que ves en pantalla (76.5% de acierto, 31.40% de retorno, 4.37% de drawdown), pero con menos operaciones históricas que la estrategia principal — se muestra aquí solo para comparar enfoques.'
  },
  {
    key: 'eth',
    title: 'VWAP + EMA — ETH/USDT',
    symbol: 'ETHUSDT',
    timeframe: '4h',
    accentColor: 'purple',
    iconSvg: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    isEthTimeframe: true,
    strategyType: 'emacross',
    strategyParams: STRATEGY3_PARAMS,
    runStrategy: runEmaCrossStrategy,
    showStochastic: false,
    description: 'Misma lógica que "VWAP + Cruce EMA" (cruce triple EMA/VWAP, mantiene hasta el cruce opuesto o SL/TP), pero sobre ETH/USDT 4h en vez de BTC/USDT — con sus propios parámetros (EMA19/45, VWAP 55), validados por separado contra datos reales de ETH ya que los de BTC no funcionaban bien aquí.'
  }
];

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
    if (config.key === 'wyckoff') {
      root.classList.remove('hidden');
      root.classList.add('flex');
    }

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

    if (config.description) {
      root.querySelector('.strategy-desc-container').classList.remove('hidden');
      root.querySelector('.strategy-desc').textContent = config.description;
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
      config.accentColor === 'cyan' ? '#00e5ff' : '#b388ff'
    );

    const metricsPanel = new MetricsPanel(domRoot);
    const signalPanel = new SignalPanel(domRoot, config.strategyType, config.isEthTimeframe);
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

  // 2. Initialize top-level strategy views switcher
  const switcherMap = {};
  Object.keys(views).forEach(k => {
    switcherMap[k] = views[k].strategyView;
  });
  StrategyView.initStrategySwitcher(switcherMap);

  // 3. Initialize alert manager bindings for all newly generated checkbox and button classes
  initAlertManager();

  // 4. Run Initial Backtests
  await Promise.all([
    runBacktestFlow('wyckoff'),
    runBacktestFlow('emacross'),
    runBacktestFlow('eth')
  ]);

  // 5. Connect WebSocket Feeds (linked to one or more strategy views)
  setupLiveFeed('BTCUSDT', ['wyckoff', 'emacross']);
  setupLiveFeed('ETHUSDT', ['eth']);
});

// Generic Backtest Flow Runner
async function runBacktestFlow(key) {
  const view = views[key];
  if (!view || view.isRunning) return;
  view.isRunning = true;

  try {
    view.metricsPanel.setLoading(true, 'Conectando con Binance API...');

    const rawData = await fetchBinanceKlines(view.config.symbol, view.config.timeframe, 1000);
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

    const res = view.config.runStrategy(candles, view.config.strategyParams, INITIAL_CAPITAL, FEE_PERCENT);
    view.chartManager.render(candles, res);
    view.metricsPanel.update(res, INITIAL_CAPITAL);
    view.tradesTable.render(res.trades, res.eventLabels);
    view.signalPanel.update(res.currentState);

    view.metricsPanel.setLoading(false);
  } catch (error) {
    console.error(error);
    view.metricsPanel.setLoading(false);
    view.metricsPanel.setError(error.message);
  } finally {
    view.isRunning = false;
  }
}

// Live WebSocket feed manager
function setupLiveFeed(symbol, configKeys) {
  const feed = new LiveFeed(symbol, '4h');
  feeds[symbol] = feed;

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

  feed.connect();
}
