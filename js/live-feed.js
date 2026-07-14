// Live Price Feed: Binance public WebSocket kline streams. BTC/USDT drives both the Wyckoff and
// VWAP+EMA Cross strategies (Strategies 1/2); a separate, independent connection drives ETH/USDT
// (Strategy 3). Updates the price badges in real time and live-updates the currently forming candle
// on the chart. When a 4h candle closes, the caller-supplied onCandleClose callback runs so the
// strategy picks up the newly confirmed candle automatically (kept as a callback rather than
// calling runBacktestFlow/runEthBacktestFlow directly, to avoid a circular dependency with main.js).
//
// Depends on: charts.js (candlestickSeries, candlestickSeries2, candlestickSeries3), config.js
// (STRATEGY_PARAMS, STRATEGY2_PARAMS, STRATEGY3_PARAMS, INITIAL_CAPITAL, FEE_PERCENT),
// strategy-wyckoff.js (runWyckoffUnifiedStrategy), strategy-emacross.js (runEmaCrossStrategy), ui.js
// (updateSignalPanel/2/3, isBacktestRunning). Must load after all of those and before main.js.

let liveSocket = null;
let lastLivePrice = null;
let lastLoadedCandles = null; // most recent closed-candle dataset from the last full backtest run, set by main.js
let lastLiveUpdateAt = 0;

const livePriceDot = document.getElementById('live-price-dot');
const livePriceValue = document.getElementById('live-price-value');
const signalLiveDot = document.getElementById('signal-live-dot');
const livePriceDot2 = document.getElementById('live-price-dot-2');
const livePriceValue2 = document.getElementById('live-price-value-2');
const signalLiveDot2 = document.getElementById('signal-live-dot-2');

// ETH/USDT live feed state, fully independent of the BTC feed above.
let ethLiveSocket = null;
let lastEthLivePrice = null;
let lastLoadedCandlesEth = null; // set by runEthBacktestFlow in main.js
let lastEthLiveUpdateAt = 0;
const livePriceDot3 = document.getElementById('live-price-dot-3');
const livePriceValue3 = document.getElementById('live-price-value-3');
const signalLiveDot3 = document.getElementById('signal-live-dot-3');

function connectLiveFeed(onCandleClose) {
  if (liveSocket) {
    liveSocket.close();
    liveSocket = null;
  }

  liveSocket = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_4h');

  liveSocket.addEventListener('open', () => {
    livePriceDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse';
    if (livePriceDot2) livePriceDot2.className = livePriceDot.className;
  });

  liveSocket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const k = msg.k;
    if (!k) return;
    const price = parseFloat(k.c);

    livePriceValue.textContent = '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    livePriceValue.className = 'font-bold tabular-nums ' +
      (lastLivePrice === null ? 'text-gray-200' : (price >= lastLivePrice ? 'text-neon-emerald' : 'text-neon-rose'));
    if (livePriceValue2) {
      livePriceValue2.textContent = livePriceValue.textContent;
      livePriceValue2.className = livePriceValue.className;
    }
    lastLivePrice = price;

    // Live-update the currently forming candle so the chart's last bar animates in real time
    if (candlestickSeries) {
      candlestickSeries.update({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: price
      });
    }
    if (candlestickSeries2) {
      candlestickSeries2.update({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: price
      });
    }

    // Once the 4h candle closes, refresh the whole backtest so the strategy evaluates the new bar
    if (k.x && !isBacktestRunning) {
      onCandleClose();
    } else {
      updateLiveSignalState(k);
    }
  });

  liveSocket.addEventListener('close', () => {
    livePriceDot.className = 'w-2 h-2 rounded-full inline-block bg-gray-500';
    if (livePriceDot2) livePriceDot2.className = livePriceDot.className;
  });

  liveSocket.addEventListener('error', () => {
    livePriceDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-rose';
    if (livePriceDot2) livePriceDot2.className = livePriceDot.className;
  });
}

// Recomputes the live signal checklist (VWAP / EMA21-50 structure / Stochastic RSI zone / open
// position P&L) against the still-forming candle, so the panel tracks live price instead of only
// updating when a 4h candle closes. Throttled since indicator recomputation over ~1000 candles is
// cheap but not free, and WebSocket ticks can arrive multiple times per second.
function updateLiveSignalState(k) {
  if (!lastLoadedCandles || isBacktestRunning) return;
  const now = Date.now();
  if (now - lastLiveUpdateAt < 1500) return;
  lastLiveUpdateAt = now;

  const liveCandle = {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v)
  };
  const tempCandles = [...lastLoadedCandles, liveCandle];
  const liveResult = runWyckoffUnifiedStrategy(tempCandles, STRATEGY_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
  updateSignalPanel(liveResult.currentState);
  if (signalLiveDot) {
    signalLiveDot.className = 'w-1.5 h-1.5 rounded-full inline-block bg-neon-emerald animate-pulse';
  }
  if (liveResult.currentState.signal) {
    checkAndTriggerAlert('BTCUSDT', 'wyckoff', liveResult.currentState.price, liveResult.currentState.signal, liveCandle.time, liveResult.currentState.lastEvent);
  }

  const liveResult2 = runEmaCrossStrategy(tempCandles, STRATEGY2_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
  updateSignalPanel2(liveResult2.currentState);
  if (signalLiveDot2) {
    signalLiveDot2.className = 'w-1.5 h-1.5 rounded-full inline-block bg-neon-purple animate-pulse';
  }
  if (liveResult2.currentState.signal) {
    checkAndTriggerAlert('BTCUSDT', 'emacross', liveResult2.currentState.price, liveResult2.currentState.signal, liveCandle.time, liveResult2.currentState.signal === 'BUY' ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN');
  }
}

// ETH/USDT live feed — same shape as connectLiveFeed, on its own WebSocket connection since it's a
// different symbol/stream than the BTC-based strategies above.
function connectEthLiveFeed(onCandleClose) {
  if (ethLiveSocket) {
    ethLiveSocket.close();
    ethLiveSocket = null;
  }

  ethLiveSocket = new WebSocket('wss://stream.binance.com:9443/ws/ethusdt@kline_4h');

  ethLiveSocket.addEventListener('open', () => {
    if (livePriceDot3) livePriceDot3.className = 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse';
  });

  ethLiveSocket.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    const k = msg.k;
    if (!k) return;
    const price = parseFloat(k.c);

    if (livePriceValue3) {
      livePriceValue3.textContent = '$' + price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      livePriceValue3.className = 'font-bold tabular-nums ' +
        (lastEthLivePrice === null ? 'text-gray-200' : (price >= lastEthLivePrice ? 'text-neon-emerald' : 'text-neon-rose'));
    }
    lastEthLivePrice = price;

    if (candlestickSeries3) {
      candlestickSeries3.update({
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: price
      });
    }

    if (k.x && !isEthBacktestRunning) {
      onCandleClose();
    } else {
      updateEthLiveSignalState(k);
    }
  });

  ethLiveSocket.addEventListener('close', () => {
    if (livePriceDot3) livePriceDot3.className = 'w-2 h-2 rounded-full inline-block bg-gray-500';
  });

  ethLiveSocket.addEventListener('error', () => {
    if (livePriceDot3) livePriceDot3.className = 'w-2 h-2 rounded-full inline-block bg-neon-rose';
  });
}

// Mirror of updateLiveSignalState for the ETH/USDT strategy panel.
function updateEthLiveSignalState(k) {
  if (!lastLoadedCandlesEth || isEthBacktestRunning) return;
  const now = Date.now();
  if (now - lastEthLiveUpdateAt < 1500) return;
  lastEthLiveUpdateAt = now;

  const liveCandle = {
    time: Math.floor(k.t / 1000),
    open: parseFloat(k.o),
    high: parseFloat(k.h),
    low: parseFloat(k.l),
    close: parseFloat(k.c),
    volume: parseFloat(k.v)
  };
  const tempCandles = [...lastLoadedCandlesEth, liveCandle];
  const liveResult3 = runEmaCrossStrategy(tempCandles, STRATEGY3_PARAMS, INITIAL_CAPITAL, FEE_PERCENT);
  updateSignalPanel3(liveResult3.currentState);
  if (signalLiveDot3) {
    signalLiveDot3.className = 'w-1.5 h-1.5 rounded-full inline-block bg-neon-purple animate-pulse';
  }
  if (liveResult3.currentState.signal) {
    checkAndTriggerAlert('ETHUSDT', 'eth', liveResult3.currentState.price, liveResult3.currentState.signal, liveCandle.time, liveResult3.currentState.signal === 'BUY' ? 'EMA_CROSS_UP' : 'EMA_CROSS_DOWN');
  }
}
