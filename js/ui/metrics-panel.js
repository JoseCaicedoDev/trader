// Metrics Panel Component
// Layer 3 (UI Presentation)
//
// A reusable component class that manages status indicators, overlays, and 
// performance metrics cards (Win Rate, Total Return, Max Drawdown, Profit Factor).
// Strictly updates presentation elements based on suffix.

class MetricsPanel {
  /**
   * @param {HTMLElement} viewRoot - Cloned template root DOM element
   */
  constructor(viewRoot) {
    this.viewRoot = viewRoot;
    this.mainOverlay = viewRoot.querySelector('.main-overlay');
    this.overlayMessage = viewRoot.querySelector('.overlay-message');
    this.statusDot = viewRoot.querySelector('.status-dot');
    this.statusText = viewRoot.querySelector('.status-text');

    this.returnMetric = viewRoot.querySelector('.metric-return');
    this.returnAbsEl = viewRoot.querySelector('.metric-return-abs');
    this.winrateMetric = viewRoot.querySelector('.metric-winrate');
    this.tradesMetric = viewRoot.querySelector('.metric-trades');
    this.drawdownMetric = viewRoot.querySelector('.metric-drawdown');
    this.factorMetric = viewRoot.querySelector('.metric-factor');
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
   * Sets the panel into an error state. Non-blocking: uses the same toast mechanism as
   * live alerts instead of window.alert(), which would freeze every strategy tab's UI thread
   * (WebSocket ticks included) until dismissed.
   * @param {string} errorMessage
   */
  setError(errorMessage) {
    if (this.statusDot) this.statusDot.className = CSS_CLASSES.DOT_LIVE_ERROR;
    if (this.statusText) this.statusText.textContent = 'Error: ' + errorMessage;
    showVisualToast('Error en backtesting', errorMessage);
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
