// App Bootstrap and Orchestrator
// Layer 4 (Application Bootstrap)
//
// Wires up all Layer 2 (Infrastructure) and Layer 3 (UI Presentation) components,
// orchestrates initial backtests, handles live WebSocket events, and updates UI state.

let btcChart1, btcChart2, ethChart3;
let btcMetrics1, btcMetrics2, ethMetrics3;
let btcSignal1, btcSignal2, ethSignal3;
let btcTable1, btcTable2, ethTable3;
let wyckoffView, emacrossView, ethView;

let btcFeed, ethFeed;
let lastLoadedCandles = null;
let lastLoadedCandlesEth = null;
let isBtcRunning = false;
let isEthRunning = false;

let lastBtcUpdate = 0;
let lastEthUpdate = 0;

window.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Infrastructure Components (Chart Managers)
  btcChart1 = new ChartManager('main-chart', 'equity-chart', '#00e5ff');
  btcChart2 = new ChartManager('main-chart-2', 'equity-chart-2', '#b388ff');
  ethChart3 = new ChartManager('main-chart-3', 'equity-chart-3', '#b388ff');

  // 2. Initialize UI Presentation Panels
  btcMetrics1 = new MetricsPanel('');
  btcMetrics2 = new MetricsPanel('-2');
  ethMetrics3 = new MetricsPanel('-3');

  btcSignal1 = new SignalPanel('', 'wyckoff');
  btcSignal2 = new SignalPanel('-2', 'emacross');
  ethSignal3 = new SignalPanel('-3', 'emacross');

  btcTable1 = new TradesTable('trades-table-body');
  btcTable2 = new TradesTable('trades-table-body-2');
  ethTable3 = new TradesTable('trades-table-body-3');

  // 3. Initialize Strategy View Controllers (Tabs & Sizer)
  wyckoffView = new StrategyView('strategy-view-wyckoff', btcChart1);
  emacrossView = new StrategyView('strategy-view-emacross', btcChart2);
  ethView = new StrategyView('strategy-view-eth', ethChart3);

  // Bind top-level strategy tabs switcher
  StrategyView.initStrategySwitcher({
    wyckoff: wyckoffView,
    emacross: emacrossView,
    eth: ethView
  });

  // 4. Run Initial Backtests
  await runBtcFlow();
  await runEthFlow();

  // 5. Connect WebSocket Feeds
  setupBtcLiveFeed();
  setupEthLiveFeed();
});

// BTC/USDT Backtest Orchestration Flow
async function runBtcFlow() {
  if (isBtcRunning) return;
  isBtcRunning = true;

  try {
    btcMetrics1.setLoading(true, 'Conectando con Binance API...');
    btcMetrics2.setLoading(true, 'Conectando con Binance API...');

    const rawData = await fetchBinanceKlines('BTCUSDT', '4h', 1000);
    if (!rawData || rawData.length === 0) {
      throw new Error('No se recibieron datos de la API de Binance.');
    }

    btcMetrics1.setLoading(true, 'Calculando indicadores y ejecutando estrategia...');
    btcMetrics2.setLoading(true, 'Calculando indicadores y ejecutando estrategia...');

    const candles = rawData.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));
    candles.sort((a, b) => a.time - b.time);
    lastLoadedCandles = candles;

    // Strategy 1: Wyckoff
    const res1 = runWyckoffUnifiedStrategy(candles, STRATEGY_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
    btcChart1.render(candles, res1);
    btcMetrics1.update(res1, INITIAL_CAPITAL);
    btcTable1.render(res1.trades, res1.eventLabels);
    btcSignal1.update(res1.currentState);

    // Strategy 2: EMA Cross
    const res2 = runEmaCrossStrategy(candles, STRATEGY2_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
    btcChart2.render(candles, res2);
    btcMetrics2.update(res2, INITIAL_CAPITAL);
    btcTable2.render(res2.trades, res2.eventLabels);
    btcSignal2.update(res2.currentState);

    btcMetrics1.setLoading(false);
    btcMetrics2.setLoading(false);
  } catch (error) {
    console.error(error);
    btcMetrics1.setLoading(false);
    btcMetrics2.setLoading(false);
    btcMetrics1.setError(error.message);
  } finally {
    isBtcRunning = false;
  }
}

// ETH/USDT Backtest Orchestration Flow
async function runEthFlow() {
  if (isEthRunning) return;
  isEthRunning = true;

  try {
    ethMetrics3.setLoading(true, 'Conectando con Binance API...');

    const rawData = await fetchBinanceKlines('ETHUSDT', '4h', 1000);
    if (!rawData || rawData.length === 0) {
      throw new Error('No se recibieron datos de la API de Binance.');
    }

    ethMetrics3.setLoading(true, 'Calculando indicadores y ejecutando estrategia...');

    const candles = rawData.map(c => ({
      time: Math.floor(c[0] / 1000),
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));
    candles.sort((a, b) => a.time - b.time);
    lastLoadedCandlesEth = candles;

    // Strategy 3: ETH EMA Cross
    const res3 = runEmaCrossStrategy(candles, STRATEGY3_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
    ethChart3.render(candles, res3);
    ethMetrics3.update(res3, INITIAL_CAPITAL);
    ethTable3.render(res3.trades, res3.eventLabels);
    ethSignal3.update(res3.currentState);

    ethMetrics3.setLoading(false);
  } catch (error) {
    console.error(error);
    ethMetrics3.setLoading(false);
    ethMetrics3.setError(error.message);
  } finally {
    isEthRunning = false;
  }
}

// Live feed listeners for BTCUSDT
function setupBtcLiveFeed() {
  btcFeed = new LiveFeed('BTCUSDT', '4h');

  const liveDot = document.getElementById('live-price-dot');
  const liveDot2 = document.getElementById('live-price-dot-2');
  const liveVal = document.getElementById('live-price-value');
  const liveVal2 = document.getElementById('live-price-value-2');

  btcFeed.addEventListener('open', () => {
    const activeClass = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse';
    if (liveDot) liveDot.className = activeClass;
    if (liveDot2) liveDot2.className = activeClass;
  });

  btcFeed.addEventListener('price', (e) => {
    const kline = e.detail;
    
    // Update charts
    btcChart1.updateLiveCandle(kline);
    btcChart2.updateLiveCandle(kline);

    // Update headers
    const priceStr = '$' + formatPrice(kline.close);
    if (liveVal) liveVal.textContent = priceStr;
    if (liveVal2) liveVal2.textContent = priceStr;

    // Throttle signal updates to 1.5s
    const now = Date.now();
    if (now - lastBtcUpdate < 1500) return;
    lastBtcUpdate = now;

    if (lastLoadedCandles && !isBtcRunning) {
      const tempCandles = [...lastLoadedCandles, kline];

      // Wyckoff State
      const res1 = runWyckoffUnifiedStrategy(tempCandles, STRATEGY_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
      btcSignal1.update(res1.currentState);
      const signalLiveDot = document.getElementById('signal-live-dot');
      if (signalLiveDot) signalLiveDot.className = CSS_CLASSES.DOT_SIGNAL_ACTIVE_WYCKOFF;
      if (res1.currentState.signal) {
        checkAndTriggerAlert('BTCUSDT', 'wyckoff', res1.currentState.price, res1.currentState.signal, kline.time, res1.currentState.lastEvent);
      }

      // EMA Cross State
      const res2 = runEmaCrossStrategy(tempCandles, STRATEGY2_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
      btcSignal2.update(res2.currentState);
      const signalLiveDot2 = document.getElementById('signal-live-dot-2');
      if (signalLiveDot2) signalLiveDot2.className = CSS_CLASSES.DOT_SIGNAL_ACTIVE_CROSS;
      if (res2.currentState.signal) {
        checkAndTriggerAlert('BTCUSDT', 'emacross', res2.currentState.price, res2.currentState.signal, kline.time, res2.currentState.signal === 'BUY' ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN');
      }
    }
  });

  btcFeed.addEventListener('candleClose', () => {
    runBtcFlow();
  });

  btcFeed.addEventListener('close', () => {
    if (liveDot) liveDot.className = CSS_CLASSES.DOT_LIVE_NEUTRAL;
    if (liveDot2) liveDot2.className = CSS_CLASSES.DOT_LIVE_NEUTRAL;
  });

  btcFeed.addEventListener('error', () => {
    if (liveDot) liveDot.className = CSS_CLASSES.DOT_LIVE_ERROR;
    if (liveDot2) liveDot2.className = CSS_CLASSES.DOT_LIVE_ERROR;
  });

  btcFeed.connect();
}

// Live feed listeners for ETHUSDT
function setupEthLiveFeed() {
  ethFeed = new LiveFeed('ETHUSDT', '4h');

  const liveDot3 = document.getElementById('live-price-dot-3');
  const liveVal3 = document.getElementById('live-price-value-3');

  ethFeed.addEventListener('open', () => {
    if (liveDot3) liveDot3.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse';
  });

  ethFeed.addEventListener('price', (e) => {
    const kline = e.detail;
    ethChart3.updateLiveCandle(kline);

    if (liveVal3) {
      liveVal3.textContent = '$' + formatPrice(kline.close);
    }

    const now = Date.now();
    if (now - lastEthUpdate < 1500) return;
    lastEthUpdate = now;

    if (lastLoadedCandlesEth && !isEthRunning) {
      const tempCandles = [...lastLoadedCandlesEth, kline];
      const res3 = runEmaCrossStrategy(tempCandles, STRATEGY3_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
      ethSignal3.update(res3.currentState);
      const signalLiveDot3 = document.getElementById('signal-live-dot-3');
      if (signalLiveDot3) signalLiveDot3.className = CSS_CLASSES.DOT_SIGNAL_ACTIVE_CROSS;
      if (res3.currentState.signal) {
        checkAndTriggerAlert('ETHUSDT', 'eth', res3.currentState.price, res3.currentState.signal, kline.time, res3.currentState.signal === 'BUY' ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN');
      }
    }
  });

  ethFeed.addEventListener('candleClose', () => {
    runEthFlow();
  });

  ethFeed.addEventListener('close', () => {
    if (liveDot3) liveDot3.className = CSS_CLASSES.DOT_LIVE_NEUTRAL;
  });

  ethFeed.connect();
}
