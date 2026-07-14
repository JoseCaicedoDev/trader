// Metrics Panel Component
// Layer 3 (UI Presentation)
//
// A reusable component class that manages status indicators, overlays, and 
// performance metrics cards (Win Rate, Total Return, Max Drawdown, Profit Factor).
// Strictly updates presentation elements based on suffix.

class MetricsPanel {
  /**
   * @param {string} suffix - DOM ID suffix ('', '-2', or '-3') to bind elements
   */
  constructor(suffix = '') {
    this.suffix = suffix;
    this.mainOverlay = document.getElementById(suffix ? `main-overlay${suffix}` : 'main-overlay');
    this.overlayMessage = document.getElementById(suffix ? `overlay-message${suffix}` : 'overlay-message');
    this.statusDot = document.getElementById(suffix ? `status-dot${suffix}` : 'status-dot');
    this.statusText = document.getElementById(suffix ? `status-text${suffix}` : 'status-text');

    this.returnMetric = document.getElementById(suffix ? `metric-return${suffix}` : 'metric-return');
    this.returnAbsEl = document.getElementById(suffix ? `metric-return-abs${suffix}` : 'metric-return-abs');
    this.winrateMetric = document.getElementById(suffix ? `metric-winrate${suffix}` : 'metric-winrate');
    this.tradesMetric = document.getElementById(suffix ? `metric-trades${suffix}` : 'metric-trades');
    this.drawdownMetric = document.getElementById(suffix ? `metric-drawdown${suffix}` : 'metric-drawdown');
    this.factorMetric = document.getElementById(suffix ? `metric-factor${suffix}` : 'metric-factor');
  }

  /**
   * Updates loading state and overlays.
   * @param {boolean} isLoading 
   * @param {string} message 
   */
  setLoading(isLoading, message = 'Procesando...') {
    if (!this.mainOverlay) return;
    if (isLoading) {
      this.mainOverlay.classList.remove('opacity-0', 'pointer-events-none');
      if (this.overlayMessage) this.overlayMessage.textContent = message;
      if (this.statusDot) this.statusDot.className = 'w-2 h-2 rounded-full inline-block bg-neon-purple shadow-[0_0_8px_#b388ff] animate-pulse';
      if (this.statusText) this.statusText.textContent = 'Procesando...';
    } else {
      this.mainOverlay.classList.add('opacity-0', 'pointer-events-none');
      if (this.statusDot) this.statusDot.className = CSS_CLASSES.DOT_LIVE_PULSE;
      if (this.statusText) this.statusText.textContent = 'API de Binance activa';
    }
  }

  /**
   * Sets the panel into an error state.
   * @param {string} errorMessage 
   */
  setError(errorMessage) {
    if (this.statusDot) this.statusDot.className = CSS_CLASSES.DOT_LIVE_ERROR;
    if (this.statusText) this.statusText.textContent = 'Error: ' + errorMessage;
    alert('Error en backtesting:\n' + errorMessage);
  }

  /**
   * Recomputes and renders performance statistics cards.
   * @param {Object} results - Simulator results object
   * @param {number} initialCapital 
   */
  update(results, initialCapital) {
    const returnAmt = results.finalBalance - initialCapital;
    const returnPct = (returnAmt / initialCapital) * 100;

    // 1. Total Return
    if (this.returnMetric) {
      this.returnMetric.textContent = `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(2)}%`;
      this.returnMetric.className = returnPct >= 0 ? CSS_CLASSES.METRIC_UP : CSS_CLASSES.METRIC_DOWN;
    }
    if (this.returnAbsEl) {
      this.returnAbsEl.textContent = `${returnAmt >= 0 ? '$' : '-$'}${formatPrice(Math.abs(returnAmt))} de ganancias netas`;
    }

    // 2. Win Rate
    const closingTrades = results.trades.filter(t => t.type === 'SELL' || t.type === 'COVER');
    const winningTrades = closingTrades.filter(t => t.pnl > 0);
    const winRate = closingTrades.length === 0 ? 0 : (winningTrades.length / closingTrades.length) * 100;
    
    if (this.winrateMetric) {
      this.winrateMetric.textContent = `${winRate.toFixed(1)}%`;
      this.winrateMetric.className = winRate >= 50 ? CSS_CLASSES.METRIC_UP : CSS_CLASSES.METRIC_DOWN;
    }

    // 3. Trade count
    if (this.tradesMetric) {
      this.tradesMetric.textContent = results.totalTrades;
    }

    // 4. Max Drawdown
    if (this.drawdownMetric) {
      this.drawdownMetric.textContent = `-${results.maxDrawdown.toFixed(2)}%`;
      this.drawdownMetric.className = CSS_CLASSES.METRIC_DOWN;
    }

    // 5. Profit Factor
    if (this.factorMetric) {
      const pfValue = results.profitFactor;
      if (pfValue === Infinity) {
        this.factorMetric.textContent = '∞';
        this.factorMetric.className = CSS_CLASSES.METRIC_UP;
      } else {
        this.factorMetric.textContent = pfValue.toFixed(2);
        this.factorMetric.className = pfValue >= 1.0 ? CSS_CLASSES.METRIC_UP : CSS_CLASSES.METRIC_DOWN;
      }
    }
  }
}
