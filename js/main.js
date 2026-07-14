// Entry point: wires up the three tab systems, runs the initial backtest for all three strategies
// (Wyckoff and VWAP+EMA Cross share one fetched BTC/USDT dataset; ETH/USDT is fetched separately for
// Strategy 3), and opens both live price feeds.
//
// Depends on every other file — must load last.
window.addEventListener('DOMContentLoaded', async () => {
  setupTabs(document.getElementById('strategy-view-wyckoff'), (target) => {
    if (target === 'chart' && priceChartInstance) {
      const el = document.getElementById('main-chart');
      priceChartInstance.resize(el.clientWidth, el.clientHeight);
    } else if (target === 'equity' && equityChartInstance) {
      const el = document.getElementById('equity-chart');
      equityChartInstance.resize(el.clientWidth, el.clientHeight);
    }
  });
  setupTabs(document.getElementById('strategy-view-emacross'), (target) => {
    if (target === 'chart' && priceChartInstance2) {
      const el = document.getElementById('main-chart-2');
      priceChartInstance2.resize(el.clientWidth, el.clientHeight);
    } else if (target === 'equity' && equityChartInstance2) {
      const el = document.getElementById('equity-chart-2');
      equityChartInstance2.resize(el.clientWidth, el.clientHeight);
    }
  });
  setupTabs(document.getElementById('strategy-view-eth'), (target) => {
    if (target === 'chart' && priceChartInstance3) {
      const el = document.getElementById('main-chart-3');
      priceChartInstance3.resize(el.clientWidth, el.clientHeight);
    } else if (target === 'equity' && equityChartInstance3) {
      const el = document.getElementById('equity-chart-3');
      equityChartInstance3.resize(el.clientWidth, el.clientHeight);
    }
  });
  setupStrategySwitcher();

  // Run initial backtests, then open both live feeds
  await runBacktestFlow();
  await runEthBacktestFlow();
  connectLiveFeed(runBacktestFlow);
  connectEthLiveFeed(runEthBacktestFlow);
});

async function runBacktestFlow() {
  try {
    setLoadingState(true, 'Conectando con Binance API...');
    setLoadingState2(true, 'Conectando con Binance API...');

    const symbol = 'BTCUSDT';
    const interval = '4h';
    const limit = 1000;

    // 1. Fetch data from Binance
    const rawData = await fetchBinanceKlines(symbol, interval, limit);
    if (!rawData || rawData.length === 0) {
      throw new Error('No se recibieron datos de la API de Binance.');
    }

    setLoadingState(true, 'Calculando indicadores y ejecutando estrategia...');
    setLoadingState2(true, 'Calculando indicadores y ejecutando estrategia...');

    // Format candles for TradingView lightweight-charts:
    // { time: timestamp/seconds, open, high, low, close }
    const candles = rawData.map(c => ({
      time: Math.floor(c[0] / 1000), // convert ms to seconds
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));

    // Sort by time ascending just in case
    candles.sort((a, b) => a.time - b.time);
    lastLoadedCandles = candles;

    // 2. Execute the unified Wyckoff strategy with the fixed, validated parameters
    const backtestResults = runWyckoffUnifiedStrategy(candles, STRATEGY_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);

    if (!backtestResults) {
      throw new Error('Error al ejecutar la estrategia.');
    }

    setLoadingState(true, 'Renderizando gráficos interactivos...');

    // 3. Render charts
    renderCharts(candles, backtestResults);

    // 4. Update UI metrics and Trade history
    updateMetrics(backtestResults, INITIAL_CAPITAL);
    populateTradesTable(backtestResults.trades, backtestResults.eventLabels);
    updateSignalPanel(backtestResults.currentState);

    // 5. Same fetched dataset also drives the second (VWAP + EMA Cross) reference strategy view
    const backtestResults2 = runEmaCrossStrategy(candles, STRATEGY2_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
    renderCharts2(candles, backtestResults2);
    updateMetrics2(backtestResults2, INITIAL_CAPITAL);
    populateTradesTable2(backtestResults2.trades, backtestResults2.eventLabels);
    updateSignalPanel2(backtestResults2.currentState);
    setLoadingState2(false);

    setLoadingState(false);
  } catch (error) {
    console.error(error);
    setLoadingState(false);
    setLoadingState2(false);
    setErrorState(error.message);
  }
}

// Strategy 3 (VWAP + EMA Cross, ETH/USDT): same shape as runBacktestFlow but for ETH/USDT 4h and
// STRATEGY3_PARAMS. Kept as its own fetch/flow (not folded into runBacktestFlow) since it's a
// different symbol with its own live feed, independent of the BTC-based strategies.
let isEthBacktestRunning = false;
async function runEthBacktestFlow() {
  if (isEthBacktestRunning) return;
  isEthBacktestRunning = true;
  try {
    setLoadingState3(true, 'Conectando con Binance API...');

    const rawData = await fetchBinanceKlines('ETHUSDT', '4h', 1000);
    if (!rawData || rawData.length === 0) {
      throw new Error('No se recibieron datos de la API de Binance.');
    }

    setLoadingState3(true, 'Calculando indicadores y ejecutando estrategia...');

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

    const backtestResults3 = runEmaCrossStrategy(candles, STRATEGY3_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
    if (!backtestResults3) {
      throw new Error('Error al ejecutar la estrategia.');
    }

    renderCharts3(candles, backtestResults3);
    updateMetrics3(backtestResults3, INITIAL_CAPITAL);
    populateTradesTable3(backtestResults3.trades, backtestResults3.eventLabels);
    updateSignalPanel3(backtestResults3.currentState);

    setLoadingState3(false);
  } catch (error) {
    console.error(error);
    setLoadingState3(false);
    if (statusDot3) statusDot3.className = 'w-2.5 h-2.5 rounded-full inline-block bg-neon-rose shadow-[0_0_8px_#ff1744]';
    if (statusText3) statusText3.textContent = 'Error: ' + error.message;
  } finally {
    isEthBacktestRunning = false;
  }
}
