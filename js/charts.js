// Chart Render Module using TradingView Lightweight Charts.
//
// Exposes chart/series instances as top-level `let` globals so ui.js (tab/strategy-switch resize)
// and live-feed.js (live candle updates) can reference them directly. No dependencies on other
// project files — only the global `LightweightCharts` from the CDN script.

// Strategy 1 (Wyckoff) chart instances
let priceChartInstance = null;
let equityChartInstance = null;
let candlestickSeries = null;
let equitySeries = null;
let indicatorSeriesList = []; // Track additional overlays (SMA lines, Bollinger bands) to remove them cleanly

// Strategy 2 (VWAP + EMA Cross) chart instances, kept fully separate from strategy 1's so both
// views can hold independent, simultaneously-rendered charts.
let priceChartInstance2 = null;
let equityChartInstance2 = null;
let candlestickSeries2 = null;
let equitySeries2 = null;
let indicatorSeriesList2 = [];

// Strategy 3 (VWAP + EMA Cross, stocks) chart instances — same idea, third independent set.
let priceChartInstance3 = null;
let equityChartInstance3 = null;
let candlestickSeries3 = null;
let equitySeries3 = null;
let indicatorSeriesList3 = [];

// Short, trader-friendly marker text — "LONG $65,746" instead of "EMA_CROSS_UP LONG @ 65746.45",
// "TP +2.1%" / "SL -2.4%" instead of "TAKE_PROFIT CIERRE LONG @ 67253.86 (+2.1%)". Keeps the
// triggering event prefix (e.g. "Spring") only when one is meaningful (Wyckoff), since the EMA
// Cross strategy's entries are always the same kind of event and repeating it on every marker just
// adds clutter. EVENT_LABELS is defined in ui.js, which has finished loading by the time charts are
// actually rendered (after DOMContentLoaded), even though ui.js loads after this file.
function formatEntryMarkerText(direction, price, eventCode) {
  const known = eventCode && EVENT_LABELS[eventCode] && eventCode !== 'EMA_CROSS_UP' && eventCode !== 'EMA_CROSS_DOWN';
  const prefix = known ? EVENT_LABELS[eventCode] + ' · ' : '';
  return prefix + direction + ' $' + price.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function formatExitMarkerText(eventCode, pnlPercent) {
  const tag = eventCode === 'STOP_LOSS' ? 'SL' : eventCode === 'TAKE_PROFIT' ? 'TP' : 'Cierre';
  const sign = pnlPercent >= 0 ? '+' : '';
  return tag + ' ' + sign + pnlPercent.toFixed(1) + '%';
}

function renderCharts(candles, results) {
  const mainChartContainer = document.getElementById('main-chart');
  const equityChartContainer = document.getElementById('equity-chart');

  // 1. Clear previous instances to prevent overlaps
  if (priceChartInstance) {
    priceChartInstance.remove();
    priceChartInstance = null;
  }
  if (equityChartInstance) {
    equityChartInstance.remove();
    equityChartInstance = null;
  }
  indicatorSeriesList = [];

  // General configuration options
  const chartOptions = {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#9ca3af',
      fontSize: 11,
      fontFamily: 'Outfit, sans-serif',
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
    },
    crosshair: {
      mode: 1, // Magnet
      vertLine: {
        color: 'rgba(0, 229, 255, 0.4)',
        width: 1,
        style: 3, // dotted
        labelBackgroundColor: '#151c2c',
      },
      horzLine: {
        color: 'rgba(0, 229, 255, 0.4)',
        width: 1,
        style: 3,
        labelBackgroundColor: '#151c2c',
      },
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    timeScale: {
      borderColor: 'rgba(255, 255, 255, 0.08)',
      timeVisible: true,
      secondsVisible: false,
    },
  };

  // 2. Initialize Price Candlestick Chart
  priceChartInstance = LightweightCharts.createChart(mainChartContainer, {
    ...chartOptions,
    height: mainChartContainer.clientHeight
  });

  candlestickSeries = priceChartInstance.addCandlestickSeries({
    upColor: '#00e676',
    downColor: '#ff1744',
    borderDownColor: '#ff1744',
    borderUpColor: '#00e676',
    wickDownColor: '#ff1744',
    wickUpColor: '#00e676',
  });

  candlestickSeries.setData(candles);

  // 3. Draw Indicators Overlay (e.g. Moving Averages or Bollinger Bands)
  if (results.indicators && results.indicators.length > 0) {
    results.indicators.forEach(ind => {
      const series = priceChartInstance.addLineSeries({
        color: ind.color,
        lineWidth: 1.5,
        lineStyle: ind.style || 0, // 2 is dashed
        title: ind.name
      });

      const indData = candles.map((c, idx) => ({
        time: c.time,
        value: ind.data[idx]
      })).filter(item => item.value !== null);

      series.setData(indData);
      indicatorSeriesList.push(series);
    });
  }

  // 4. Map Trade entries and exits on Candlestick Chart. Four distinct actions since positions can
  // be LONG or SHORT: BUY (open long), SELL (close long), SHORT (open short), COVER (close short).
  // Short, trader-friendly text (see formatEntryMarkerText/formatExitMarkerText) — the Wyckoff
  // event that triggered an entry is kept as a prefix since it's meaningful here (Spring/LPS/etc).
  const markers = [];
  results.trades.forEach(t => {
    const eventCode = results.eventLabels ? results.eventLabels[t.index] : null;
    if (t.type === 'BUY') {
      markers.push({
        time: t.time, position: 'belowBar', color: '#00e676', shape: 'arrowUp',
        text: formatEntryMarkerText('LONG', t.price, eventCode), size: 1.2
      });
    } else if (t.type === 'SHORT') {
      markers.push({
        time: t.time, position: 'aboveBar', color: '#ff1744', shape: 'arrowDown',
        text: formatEntryMarkerText('SHORT', t.price, eventCode), size: 1.2
      });
    } else if (t.type === 'SELL') {
      markers.push({
        time: t.time, position: 'aboveBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowDown',
        text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2
      });
    } else if (t.type === 'COVER') {
      markers.push({
        time: t.time, position: 'belowBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowUp',
        text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2
      });
    }
  });

  candlestickSeries.setMarkers(markers);

  // 4b. Draw Stop Loss / Take Profit as horizontal price lines for the currently open position (if
  // any), so the user can see at a glance where the trade plan sits relative to live price.
  if (results.currentState && results.currentState.openTrade) {
    const t = results.currentState.openTrade;
    if (t.stopLoss !== null) {
      candlestickSeries.createPriceLine({
        price: t.stopLoss, color: '#ff1744', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'Stop Loss'
      });
    }
    if (t.takeProfit !== null) {
      candlestickSeries.createPriceLine({
        price: t.takeProfit, color: '#00e676', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'Take Profit'
      });
    }
    candlestickSeries.createPriceLine({
      price: t.entryPrice, color: '#00e5ff', lineWidth: 1, lineStyle: 3,
      axisLabelVisible: true, title: 'Entrada ' + t.direction
    });
  }

  // 5. Initialize Equity Curve Line Chart
  equityChartInstance = LightweightCharts.createChart(equityChartContainer, {
    ...chartOptions,
    height: equityChartContainer.clientHeight
  });

  equitySeries = equityChartInstance.addLineSeries({
    color: '#00e5ff',
    lineWidth: 2,
    topColor: 'rgba(0, 229, 255, 0.4)',
    bottomColor: 'rgba(0, 229, 255, 0.0)',
    invertable: false,
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01,
    },
  });

  equitySeries.setData(results.equityCurve);

  // 6. Connect charts zoom/pan scales for synchronized scrolling
  let isSyncing = false;

  const priceTimeScale = priceChartInstance.timeScale();
  const equityTimeScale = equityChartInstance.timeScale();

  priceTimeScale.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing || !range) return;
    isSyncing = true;
    equityTimeScale.setVisibleLogicalRange(range);
    isSyncing = false;
  });

  equityTimeScale.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing || !range) return;
    isSyncing = true;
    priceTimeScale.setVisibleLogicalRange(range);
    isSyncing = false;
  });

  // Make charts responsive
  window.addEventListener('resize', () => {
    if (priceChartInstance) {
      priceChartInstance.resize(mainChartContainer.clientWidth, mainChartContainer.clientHeight);
    }
    if (equityChartInstance) {
      equityChartInstance.resize(equityChartContainer.clientWidth, equityChartContainer.clientHeight);
    }
  });
}

// Chart Render Module for Strategy 2 (VWAP + EMA Cross) — same structure as renderCharts, targeting
// the '-2' suffixed containers and the *2 chart instances so both views can render independently.
function renderCharts2(candles, results) {
  const mainChartContainer = document.getElementById('main-chart-2');
  const equityChartContainer = document.getElementById('equity-chart-2');

  if (priceChartInstance2) {
    priceChartInstance2.remove();
    priceChartInstance2 = null;
  }
  if (equityChartInstance2) {
    equityChartInstance2.remove();
    equityChartInstance2 = null;
  }
  indicatorSeriesList2 = [];

  const chartOptions = {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#9ca3af',
      fontSize: 11,
      fontFamily: 'Outfit, sans-serif',
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
    },
    crosshair: {
      mode: 1,
      vertLine: { color: 'rgba(179, 136, 255, 0.4)', width: 1, style: 3, labelBackgroundColor: '#151c2c' },
      horzLine: { color: 'rgba(179, 136, 255, 0.4)', width: 1, style: 3, labelBackgroundColor: '#151c2c' },
    },
    rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' },
    timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true, secondsVisible: false },
  };

  priceChartInstance2 = LightweightCharts.createChart(mainChartContainer, {
    ...chartOptions,
    height: mainChartContainer.clientHeight
  });

  candlestickSeries2 = priceChartInstance2.addCandlestickSeries({
    upColor: '#00e676', downColor: '#ff1744', borderDownColor: '#ff1744', borderUpColor: '#00e676',
    wickDownColor: '#ff1744', wickUpColor: '#00e676',
  });
  candlestickSeries2.setData(candles);

  if (results.indicators && results.indicators.length > 0) {
    results.indicators.forEach(ind => {
      const series = priceChartInstance2.addLineSeries({
        color: ind.color, lineWidth: 1.5, lineStyle: ind.style || 0, title: ind.name
      });
      const indData = candles.map((c, idx) => ({ time: c.time, value: ind.data[idx] })).filter(item => item.value !== null);
      series.setData(indData);
      indicatorSeriesList2.push(series);
    });
  }

  const markers = [];
  results.trades.forEach(t => {
    const eventCode = results.eventLabels ? results.eventLabels[t.index] : null;
    if (t.type === 'BUY') {
      markers.push({ time: t.time, position: 'belowBar', color: '#00e676', shape: 'arrowUp', text: formatEntryMarkerText('LONG', t.price, eventCode), size: 1.2 });
    } else if (t.type === 'SHORT') {
      markers.push({ time: t.time, position: 'aboveBar', color: '#ff1744', shape: 'arrowDown', text: formatEntryMarkerText('SHORT', t.price, eventCode), size: 1.2 });
    } else if (t.type === 'SELL') {
      markers.push({ time: t.time, position: 'aboveBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowDown', text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2 });
    } else if (t.type === 'COVER') {
      markers.push({ time: t.time, position: 'belowBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowUp', text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2 });
    }
  });
  candlestickSeries2.setMarkers(markers);

  if (results.currentState && results.currentState.openTrade) {
    const t = results.currentState.openTrade;
    if (t.stopLoss !== null) {
      candlestickSeries2.createPriceLine({ price: t.stopLoss, color: '#ff1744', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Stop Loss' });
    }
    if (t.takeProfit !== null) {
      candlestickSeries2.createPriceLine({ price: t.takeProfit, color: '#00e676', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Take Profit' });
    }
    candlestickSeries2.createPriceLine({ price: t.entryPrice, color: '#b388ff', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Entrada ' + t.direction });
  }

  equityChartInstance2 = LightweightCharts.createChart(equityChartContainer, {
    ...chartOptions,
    height: equityChartContainer.clientHeight
  });
  equitySeries2 = equityChartInstance2.addLineSeries({
    color: '#b388ff', lineWidth: 2, topColor: 'rgba(179, 136, 255, 0.4)', bottomColor: 'rgba(179, 136, 255, 0.0)',
    invertable: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
  });
  equitySeries2.setData(results.equityCurve);

  let isSyncing2 = false;
  const priceTimeScale2 = priceChartInstance2.timeScale();
  const equityTimeScale2 = equityChartInstance2.timeScale();
  priceTimeScale2.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing2 || !range) return;
    isSyncing2 = true;
    equityTimeScale2.setVisibleLogicalRange(range);
    isSyncing2 = false;
  });
  equityTimeScale2.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing2 || !range) return;
    isSyncing2 = true;
    priceTimeScale2.setVisibleLogicalRange(range);
    isSyncing2 = false;
  });

  window.addEventListener('resize', () => {
    if (priceChartInstance2) {
      priceChartInstance2.resize(mainChartContainer.clientWidth, mainChartContainer.clientHeight);
    }
    if (equityChartInstance2) {
      equityChartInstance2.resize(equityChartContainer.clientWidth, equityChartContainer.clientHeight);
    }
  });
}

// Chart Render Module for Strategy 3 (VWAP + EMA Cross, stocks) — same structure as renderCharts2,
// targeting the '-3' suffixed containers and the *3 chart instances.
function renderCharts3(candles, results) {
  const mainChartContainer = document.getElementById('main-chart-3');
  const equityChartContainer = document.getElementById('equity-chart-3');

  if (priceChartInstance3) {
    priceChartInstance3.remove();
    priceChartInstance3 = null;
  }
  if (equityChartInstance3) {
    equityChartInstance3.remove();
    equityChartInstance3 = null;
  }
  indicatorSeriesList3 = [];

  const chartOptions = {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#9ca3af',
      fontSize: 11,
      fontFamily: 'Outfit, sans-serif',
    },
    grid: {
      vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
      horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
    },
    crosshair: {
      mode: 1,
      vertLine: { color: 'rgba(179, 136, 255, 0.4)', width: 1, style: 3, labelBackgroundColor: '#151c2c' },
      horzLine: { color: 'rgba(179, 136, 255, 0.4)', width: 1, style: 3, labelBackgroundColor: '#151c2c' },
    },
    rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.08)' },
    timeScale: { borderColor: 'rgba(255, 255, 255, 0.08)', timeVisible: true, secondsVisible: false },
  };

  priceChartInstance3 = LightweightCharts.createChart(mainChartContainer, {
    ...chartOptions,
    height: mainChartContainer.clientHeight
  });

  candlestickSeries3 = priceChartInstance3.addCandlestickSeries({
    upColor: '#00e676', downColor: '#ff1744', borderDownColor: '#ff1744', borderUpColor: '#00e676',
    wickDownColor: '#ff1744', wickUpColor: '#00e676',
  });
  candlestickSeries3.setData(candles);

  if (results.indicators && results.indicators.length > 0) {
    results.indicators.forEach(ind => {
      const series = priceChartInstance3.addLineSeries({
        color: ind.color, lineWidth: 1.5, lineStyle: ind.style || 0, title: ind.name
      });
      const indData = candles.map((c, idx) => ({ time: c.time, value: ind.data[idx] })).filter(item => item.value !== null);
      series.setData(indData);
      indicatorSeriesList3.push(series);
    });
  }

  const markers = [];
  results.trades.forEach(t => {
    const eventCode = results.eventLabels ? results.eventLabels[t.index] : null;
    if (t.type === 'BUY') {
      markers.push({ time: t.time, position: 'belowBar', color: '#00e676', shape: 'arrowUp', text: formatEntryMarkerText('LONG', t.price, eventCode), size: 1.2 });
    } else if (t.type === 'SHORT') {
      markers.push({ time: t.time, position: 'aboveBar', color: '#ff1744', shape: 'arrowDown', text: formatEntryMarkerText('SHORT', t.price, eventCode), size: 1.2 });
    } else if (t.type === 'SELL') {
      markers.push({ time: t.time, position: 'aboveBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowDown', text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2 });
    } else if (t.type === 'COVER') {
      markers.push({ time: t.time, position: 'belowBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowUp', text: formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2 });
    }
  });
  candlestickSeries3.setMarkers(markers);

  if (results.currentState && results.currentState.openTrade) {
    const t = results.currentState.openTrade;
    if (t.stopLoss !== null) {
      candlestickSeries3.createPriceLine({ price: t.stopLoss, color: '#ff1744', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Stop Loss' });
    }
    if (t.takeProfit !== null) {
      candlestickSeries3.createPriceLine({ price: t.takeProfit, color: '#00e676', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Take Profit' });
    }
    candlestickSeries3.createPriceLine({ price: t.entryPrice, color: '#b388ff', lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title: 'Entrada ' + t.direction });
  }

  equityChartInstance3 = LightweightCharts.createChart(equityChartContainer, {
    ...chartOptions,
    height: equityChartContainer.clientHeight
  });
  equitySeries3 = equityChartInstance3.addLineSeries({
    color: '#b388ff', lineWidth: 2, topColor: 'rgba(179, 136, 255, 0.4)', bottomColor: 'rgba(179, 136, 255, 0.0)',
    invertable: false, priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
  });
  equitySeries3.setData(results.equityCurve);

  let isSyncing3 = false;
  const priceTimeScale3 = priceChartInstance3.timeScale();
  const equityTimeScale3 = equityChartInstance3.timeScale();
  priceTimeScale3.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing3 || !range) return;
    isSyncing3 = true;
    equityTimeScale3.setVisibleLogicalRange(range);
    isSyncing3 = false;
  });
  equityTimeScale3.subscribeVisibleLogicalRangeChange(range => {
    if (isSyncing3 || !range) return;
    isSyncing3 = true;
    priceTimeScale3.setVisibleLogicalRange(range);
    isSyncing3 = false;
  });

  window.addEventListener('resize', () => {
    if (priceChartInstance3) {
      priceChartInstance3.resize(mainChartContainer.clientWidth, mainChartContainer.clientHeight);
    }
    if (equityChartInstance3) {
      equityChartInstance3.resize(equityChartContainer.clientWidth, equityChartContainer.clientHeight);
    }
  });
}
