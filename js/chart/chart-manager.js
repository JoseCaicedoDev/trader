// Chart Manager Component
// Layer 2 (Infrastructure / Rendering Wrapper)
//
// A reusable, parameter-driven class that encapsulates LightweightCharts creation,
// synchronization, markers, dynamic overlays (EMA, VWAP, Bollinger), S/R price lines,
// and automatic responsive layout cleanup.
//
// No business logic, no globals, no coupling to specific strategy implementations.

class ChartManager {
  /**
   * @param {HTMLElement} priceContainer - DOM element for the price candlestick chart
   * @param {HTMLElement} equityContainer - DOM element for the equity line chart
   * @param {string} accentColor - Hex code representing the theme color (cyan, purple, etc.)
   * @param {Object} eventLabels - Event-code -> display-name map (injected, not read from a
   *   global) so this Layer 2 file never depends on the Layer 3 constant defined in dom-utils.js.
   */
  constructor(priceContainer, equityContainer, accentColor, eventLabels = {}) {
    this.priceContainer = priceContainer;
    this.equityContainer = equityContainer;
    this.accentColor = accentColor;
    this.eventLabels = eventLabels;

    this.priceChart = null;
    this.equityChart = null;
    this.candlestickSeries = null;
    this.equitySeries = null;
    this.indicatorSeriesList = [];
    this.priceLinesList = [];

    this.isSyncing = false;
    this.resizeObserver = null;
  }

  /**
   * Creates chart instances and sets up logical time scale synchronization.
   * @param {Array<Object>} candles - Initial candles array
   * @param {Object} results - Backtest results object
   */
  render(candles, results) {
    this.destroy(); // Ensure any previous instance is fully cleaned up

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
        mode: 1, // Magnet mode
        vertLine: {
          color: `${this.accentColor}66`, // translucent version
          width: 1,
          style: 3, // dotted
          labelBackgroundColor: '#151c2c',
        },
        horzLine: {
          color: `${this.accentColor}66`,
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

    // 1. Candlestick Price Chart
    this.priceChart = LightweightCharts.createChart(this.priceContainer, {
      ...chartOptions,
      height: this.priceContainer.clientHeight
    });

    this.candlestickSeries = this.priceChart.addCandlestickSeries({
      upColor: '#00e676',
      downColor: '#ff1744',
      borderDownColor: '#ff1744',
      borderUpColor: '#00e676',
      wickDownColor: '#ff1744',
      wickUpColor: '#00e676',
    });

    this.candlestickSeries.setData(candles);

    // 2. Draw Dynamic Indicators (VWAP, EMAs, Ranges)
    if (results.indicators && results.indicators.length > 0) {
      results.indicators.forEach(ind => {
        const series = this.priceChart.addLineSeries({
          color: ind.color,
          lineWidth: 1.5,
          lineStyle: ind.style || 0,
          title: ind.name
        });

        const indData = candles.map((c, idx) => ({
          time: c.time,
          value: ind.data[idx]
        })).filter(item => item.value !== null);

        series.setData(indData);
        this.indicatorSeriesList.push(series);
      });
    }

    // 3. Render Trades History Markers
    this.renderMarkers(results.trades, results.eventLabels);

    // 4. Render Active SL/TP/Entry Price Lines
    this.renderActivePriceLines(results.currentState);

    // 5. Equity Curve Chart
    this.equityChart = LightweightCharts.createChart(this.equityContainer, {
      ...chartOptions,
      height: this.equityContainer.clientHeight
    });

    this.equitySeries = this.equityChart.addLineSeries({
      color: this.accentColor,
      lineWidth: 2,
      topColor: `${this.accentColor}66`,
      bottomColor: `${this.accentColor}00`,
      invertable: false,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });

    this.equitySeries.setData(results.equityCurve);

    // 6. Connect Zoom/Pan Time Scale Synchronization
    const priceScale = this.priceChart.timeScale();
    const equityScale = this.equityChart.timeScale();

    priceScale.subscribeVisibleLogicalRangeChange(range => {
      if (this.isSyncing || !range) return;
      this.isSyncing = true;
      equityScale.setVisibleLogicalRange(range);
      this.isSyncing = false;
    });

    equityScale.subscribeVisibleLogicalRangeChange(range => {
      if (this.isSyncing || !range) return;
      this.isSyncing = true;
      priceScale.setVisibleLogicalRange(range);
      this.isSyncing = false;
    });

    // 7. Setup Responsive ResizeObserver (replaces window.addEventListener)
    this.setupResizeObserver();
  }

  /**
   * Updates the last forming candle on the price chart.
   * @param {Object} kline - Standardized live candle data
   */
  updateLiveCandle(kline) {
    if (this.candlestickSeries) {
      this.candlestickSeries.update({
        time: kline.time,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        close: kline.close
      });
    }
  }

  /**
   * Resizes price and equity charts to match their current DOM container widths/heights.
   */
  resize() {
    if (this.priceChart && this.priceContainer) {
      this.priceChart.resize(this.priceContainer.clientWidth, this.priceContainer.clientHeight);
    }
    if (this.equityChart && this.equityContainer) {
      this.equityChart.resize(this.equityContainer.clientWidth, this.equityContainer.clientHeight);
    }
  }

  renderMarkers(trades, eventLabels) {
    if (!trades) return;
    const markers = [];
    trades.forEach(t => {
      const eventCode = eventLabels ? eventLabels[t.index] : null;
      if (t.type === 'BUY') {
        markers.push({
          time: t.time, position: 'belowBar', color: '#00e676', shape: 'arrowUp',
          text: this.formatEntryMarkerText('LONG', t.price, eventCode), size: 1.2
        });
      } else if (t.type === 'SHORT') {
        markers.push({
          time: t.time, position: 'aboveBar', color: '#ff1744', shape: 'arrowDown',
          text: this.formatEntryMarkerText('SHORT', t.price, eventCode), size: 1.2
        });
      } else if (t.type === 'SELL') {
        markers.push({
          time: t.time, position: 'aboveBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowDown',
          text: this.formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2
        });
      } else if (t.type === 'COVER') {
        markers.push({
          time: t.time, position: 'belowBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowUp',
          text: this.formatExitMarkerText(eventCode, t.pnlPercent), size: 1.2
        });
      }
    });
    this.candlestickSeries.setMarkers(markers);
  }

  renderActivePriceLines(currentState) {
    if (!currentState || !currentState.openTrade) return;
    const t = currentState.openTrade;

    if (t.stopLoss !== null) {
      const line = this.candlestickSeries.createPriceLine({
        price: t.stopLoss, color: '#ff1744', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'Stop Loss'
      });
      this.priceLinesList.push(line);
    }
    if (t.takeProfit !== null) {
      const line = this.candlestickSeries.createPriceLine({
        price: t.takeProfit, color: '#00e676', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: 'Take Profit'
      });
      this.priceLinesList.push(line);
    }
    const lineEntry = this.candlestickSeries.createPriceLine({
      price: t.entryPrice, color: this.accentColor, lineWidth: 1, lineStyle: 3,
      axisLabelVisible: true, title: 'Entrada ' + t.direction
    });
    this.priceLinesList.push(lineEntry);
  }

  formatEntryMarkerText(direction, price, eventCode) {
    const known = eventCode && this.eventLabels[eventCode] && eventCode !== 'EMA_CROSS_UP' && eventCode !== 'EMA_CROSS_DOWN';
    const prefix = known ? this.eventLabels[eventCode] + ' · ' : '';
    return prefix + direction + ' $' + price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  formatExitMarkerText(eventCode, pnlPercent) {
    const tag = eventCode === 'STOP_LOSS' ? 'SL' : eventCode === 'TAKE_PROFIT' ? 'TP' : 'Cierre';
    const sign = pnlPercent >= 0 ? '+' : '';
    return tag + ' ' + sign + pnlPercent.toFixed(1) + '%';
  }

  setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => this.resize());
    });
    if (this.priceContainer) this.resizeObserver.observe(this.priceContainer);
  }

  /**
   * Safely deletes chart instances, disconnects listeners, and resets layout properties.
   */
  destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.priceLinesList.forEach(line => {
      if (this.candlestickSeries) {
        this.candlestickSeries.removePriceLine(line);
      }
    });
    this.priceLinesList = [];

    if (this.priceChart) {
      this.priceChart.remove();
      this.priceChart = null;
    }
    if (this.equityChart) {
      this.equityChart.remove();
      this.equityChart = null;
    }
    this.candlestickSeries = null;
    this.equitySeries = null;
    this.indicatorSeriesList = [];
  }
}
