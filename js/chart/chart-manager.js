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
  constructor(priceContainer, equityContainer, accentColor, eventLabels = {}, lowerContainer = null) {
    this.priceContainer = priceContainer;
    this.equityContainer = equityContainer;
    // Optional container for oscillators (e.g. RSI) drawn as their own chart under the price chart.
    // Without it, such indicators fall back to a strip overlaid at the bottom of the price chart.
    this.lowerContainer = lowerContainer;
    this.accentColor = accentColor;
    this.eventLabels = eventLabels;

    this.priceChart = null;
    this.equityChart = null;
    this.lowerChart = null;
    this.lowerSeries = null;
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

    // With a chart stacked underneath, both right axes get the same fixed width so their candles
    // line up vertically bar for bar.
    if (this.lowerContainer) {
      chartOptions.rightPriceScale = { ...chartOptions.rightPriceScale, minimumWidth: 82 };
    }

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

    // 2. Draw Dynamic Indicators (VWAP, EMAs, Ranges). An indicator with its own `priceScaleId`
    // (e.g. RSI, 0-100) is drawn in a strip under the candles instead of on the price scale.
    const lowerIndicators = this.lowerContainer
      ? (results.indicators || []).filter(ind => ind.priceScaleId)
      : [];
    const overlayIndicators = (results.indicators || []).filter(ind => !lowerIndicators.includes(ind));
    if (overlayIndicators.length > 0) {
      const hasLowerPane = overlayIndicators.some(ind => ind.priceScaleId);
      if (hasLowerPane) {
        this.candlestickSeries.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.3 } });
      }
      overlayIndicators.forEach(ind => {
        const series = this.priceChart.addLineSeries({
          color: ind.color,
          lineWidth: 1.5,
          lineStyle: ind.style || 0,
          title: ind.name,
          ...(ind.priceScaleId ? {
            priceScaleId: ind.priceScaleId,
            autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } })
          } : {})
        });
        if (ind.priceScaleId) {
          series.priceScale().applyOptions({ scaleMargins: { top: 0.75, bottom: 0.02 } });
          (ind.levels || []).forEach(level => series.createPriceLine({
            price: level, color: 'rgba(255, 255, 255, 0.35)', lineWidth: 1, lineStyle: 2,
            axisLabelVisible: true, title: ''
          }));
        }

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

    // 5b. Oscillator chart under the price chart (RSI), one bar per candle so it lines up 1:1
    if (lowerIndicators.length > 0) {
      this.renderLowerChart(candles, lowerIndicators, results, chartOptions);
    }

    // 6. Connect Zoom/Pan Time Scale Synchronization across every chart that exists
    const timeScales = [this.priceChart, this.equityChart, this.lowerChart]
      .filter(Boolean)
      .map(chart => chart.timeScale());
    timeScales.forEach(source => {
      source.subscribeVisibleLogicalRangeChange(range => {
        if (this.isSyncing || !range) return;
        this.isSyncing = true;
        timeScales.forEach(target => { if (target !== source) target.setVisibleLogicalRange(range); });
        this.isSyncing = false;
      });
    });

    // 7. Setup Responsive ResizeObserver (replaces window.addEventListener)
    this.setupResizeObserver();
  }

  /**
   * Draws oscillator indicators in their own chart below the price chart, with horizontal levels,
   * entry/exit markers at the oscillator value, and a crosshair mirrored to and from the price chart.
   */
  renderLowerChart(candles, indicators, results, chartOptions) {
    this.lowerChart = LightweightCharts.createChart(this.lowerContainer, {
      ...chartOptions,
      rightPriceScale: { ...chartOptions.rightPriceScale, scaleMargins: { top: 0.08, bottom: 0.08 } },
      height: this.lowerContainer.clientHeight
    });

    indicators.forEach((ind, k) => {
      const series = this.lowerChart.addLineSeries({
        color: ind.color,
        lineWidth: 1.5,
        title: ind.name,
        priceLineVisible: false,
        autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } })
      });
      // Whitespace items (time only) for the warm-up candles keep bar indices identical to the price
      // chart, which the logical-range sync relies on.
      series.setData(candles.map((c, idx) => (ind.data[idx] === null
        ? { time: c.time }
        : { time: c.time, value: ind.data[idx] })));
      (ind.levels || []).forEach(level => series.createPriceLine({
        price: level, color: 'rgba(255, 255, 255, 0.4)', lineWidth: 1, lineStyle: 2,
        axisLabelVisible: true, title: ''
      }));
      if (k === 0) {
        this.lowerSeries = series;
        this.lowerValues = new Map(candles.map((c, idx) => [c.time, ind.data[idx]]));
      }
    });

    if (this.lowerSeries && results.trades) {
      const markers = [];
      results.trades.forEach(t => {
        if (t.type === 'BUY') {
          markers.push({ time: t.time, position: 'belowBar', color: '#00e676', shape: 'arrowUp', text: 'Compra' });
        } else if (t.type === 'SELL') {
          markers.push({
            time: t.time, position: 'aboveBar', color: t.pnl >= 0 ? '#00e676' : '#ff1744', shape: 'arrowDown',
            text: (t.pnlPercent >= 0 ? '+' : '') + t.pnlPercent.toFixed(1) + '%'
          });
        }
      });
      this.lowerSeries.setMarkers(markers);
    }

    // Mirror the crosshair so the RSI value of any candle can be read while hovering the price.
    const closes = new Map(candles.map(c => [c.time, c.close]));
    this.priceChart.subscribeCrosshairMove(param => {
      if (this.isSyncingCrosshair || !this.lowerChart) return;
      this.isSyncingCrosshair = true;
      const value = param.time !== undefined ? this.lowerValues.get(param.time) : null;
      if (value !== null && value !== undefined) this.lowerChart.setCrosshairPosition(value, param.time, this.lowerSeries);
      else this.lowerChart.clearCrosshairPosition();
      this.isSyncingCrosshair = false;
    });
    this.lowerChart.subscribeCrosshairMove(param => {
      if (this.isSyncingCrosshair || !this.priceChart) return;
      this.isSyncingCrosshair = true;
      const close = param.time !== undefined ? closes.get(param.time) : undefined;
      if (close !== undefined) this.priceChart.setCrosshairPosition(close, param.time, this.candlestickSeries);
      else this.priceChart.clearCrosshairPosition();
      this.isSyncingCrosshair = false;
    });
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
    if (this.lowerChart && this.lowerContainer) {
      this.lowerChart.resize(this.lowerContainer.clientWidth, this.lowerContainer.clientHeight);
    }
  }

  renderMarkers(trades, eventLabels) {
    if (!trades) return;
    const markers = [];
    trades.forEach(t => {
      // A trade may carry its own label (the counter book shares candle indices with the strategy's
      // exits, so the per-candle array cannot tell the two apart); fall back to it when present.
      const eventCode = t.eventCode || (eventLabels ? eventLabels[t.index] : null);
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
    if (this.lowerChart && this.lowerContainer) this.resizeObserver.observe(this.lowerContainer);
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
    if (this.lowerChart) {
      this.lowerChart.remove();
      this.lowerChart = null;
    }
    this.lowerSeries = null;
    this.lowerValues = null;
    this.candlestickSeries = null;
    this.equitySeries = null;
    this.indicatorSeriesList = [];
  }
}
