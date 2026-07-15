// Signal Panel Component
// Layer 3 (UI Presentation)
//
// A reusable class that manages the checklist panel displaying live trend structures
// (VWAP, EMA alignment, Stochastic RSI, and open trade details).
//
// Strategy-specific presentation (which EMA periods to name, how many price decimals) is
// injected via the constructor rather than branched on a hardcoded strategy-type string —
// adding a Strategy 4 requires zero changes here (Open/Closed Principle). Whether to render the
// Wyckoff-only extras (event badge + Stochastic RSI) is decided per-update by duck-typing the
// `state` object shape (`'lastEvent' in state`), matching the documented contract that all
// strategy states share one interface and extra fields are simply ignored (Liskov Substitution).

class SignalPanel {
  /**
   * @param {HTMLElement} viewRoot - Cloned template root DOM element
   * @param {Object} options
   * @param {number} options.emaFastLabel - Fast EMA period to display (e.g. 21)
   * @param {number} options.emaSlowLabel - Slow EMA period to display (e.g. 30 or 50)
   * @param {number} options.priceDecimals - Decimal places for formatted prices (0 for BTC, 2 for ETH)
   */
  constructor(viewRoot, { emaFastLabel = 21, emaSlowLabel = 50, priceDecimals = 0, maLabelPrefix = 'EMA' } = {}) {
    this.viewRoot = viewRoot;
    this.emaFastLabel = emaFastLabel;
    this.emaSlowLabel = emaSlowLabel;
    this.priceDecimals = priceDecimals;
    this.maLabelPrefix = maLabelPrefix;

    // Common checklist items
    this.vwapDot = viewRoot.querySelector('.chk-vwap-dot');
    this.vwapText = viewRoot.querySelector('.chk-vwap-text');
    this.emaDot = viewRoot.querySelector('.chk-ema-dot');
    this.emaText = viewRoot.querySelector('.chk-ema-text');
    this.posDot = viewRoot.querySelector('.chk-position-dot');
    this.posText = viewRoot.querySelector('.chk-position-text');
    this.posDetail = viewRoot.querySelector('.signal-position-detail');

    // Wyckoff-only items (present in the DOM for every strategy, toggled visible via CSS in
    // main.js; only ever populated here when the live state includes Wyckoff-shaped fields)
    this.eventBadge = viewRoot.querySelector('.signal-event-badge');
    this.stochDot = viewRoot.querySelector('.chk-stoch-dot');
    this.stochText = viewRoot.querySelector('.chk-stoch-text');

    this.posEntry = viewRoot.querySelector('.pos-entry');
    this.posSl = viewRoot.querySelector('.pos-sl');
    this.posTp = viewRoot.querySelector('.pos-tp');
    this.posPnl = viewRoot.querySelector('.pos-pnl');
  }

  /**
   * Updates the checklist widgets based on latest live state.
   * @param {Object} state - Strategy's current live state snapshot
   */
  update(state) {
    if (!state) return;
    this.updateVwapCheck(state);
    this.updateEmaCheck(state);
    if ('lastEvent' in state) this.updateWyckoffExtras(state);
    this.updatePositionCheck(state);
  }

  /** Renders the VWAP trend-gate row. */
  updateVwapCheck(state) {
    if (!this.vwapDot || !this.vwapText) return;
    if (state.vwap === null) {
      this.vwapDot.className = CSS_CLASSES.DOT_NEUTRAL;
      this.vwapText.textContent = 'Calculando...';
      return;
    }
    this.vwapDot.className = state.aboveVwap ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
    this.vwapText.textContent = (state.aboveVwap ? 'Precio arriba (alcista)' : 'Precio abajo (bajista)') +
      ' — $' + formatPrice(state.vwap, this.priceDecimals);
  }

  /** Renders the EMA structure row using the injected fast/slow period labels. */
  updateEmaCheck(state) {
    if (!this.emaDot || !this.emaText) return;
    if (state.bullishStructure === null) {
      this.emaDot.className = CSS_CLASSES.DOT_NEUTRAL;
      this.emaText.textContent = 'Calculando...';
      return;
    }
    this.emaDot.className = state.bullishStructure ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
    const comparator = state.bullishStructure ? '>' : '<';
    const trend = state.bullishStructure ? 'alcista' : 'bajista';
    const p = this.maLabelPrefix;
    this.emaText.textContent = `${p}${this.emaFastLabel} ${comparator} ${p}${this.emaSlowLabel} (${trend})`;
  }

  /** Renders the Wyckoff event badge + Stochastic RSI row (only called for Wyckoff-shaped state). */
  updateWyckoffExtras(state) {
    if (this.eventBadge) {
      const hasEvent = Boolean(state.lastEvent);
      this.eventBadge.textContent = hasEvent
        ? 'Evento detectado: ' + (EVENT_LABELS[state.lastEvent] || state.lastEvent)
        : 'Sin evento Wyckoff activo';
      this.eventBadge.className = hasEvent ? CSS_CLASSES.BADGE_EVENT_ACTIVE : CSS_CLASSES.BADGE_EVENT_INACTIVE;
    }
    if (!this.stochDot || !this.stochText) return;
    if (state.stochK === null) {
      this.stochDot.className = CSS_CLASSES.DOT_NEUTRAL;
      this.stochText.textContent = 'Calculando...';
      return;
    }
    const kStr = state.stochK.toFixed(0);
    this.stochDot.className = (state.stochOversold || state.stochOverbought) ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_NEUTRAL;
    this.stochText.textContent = state.stochOversold ? `Sobrevendido (%K=${kStr})`
      : state.stochOverbought ? `Sobrecomprado (%K=${kStr})`
      : `Zona neutral (%K=${kStr})`;
  }

  /** Renders the open-position summary row and detail panel (entry/SL/TP/unrealized P&L). */
  updatePositionCheck(state) {
    if (!this.posDot || !this.posText) return;
    if (!state.openTrade) {
      this.posDot.className = CSS_CLASSES.DOT_NEUTRAL;
      this.posText.textContent = 'Sin posición';
      if (this.posDetail) this.posDetail.classList.add('hidden');
      return;
    }
    const t = state.openTrade;
    this.posDot.className = t.unrealizedPct >= 0 ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
    this.posText.textContent = t.direction + (t.unrealizedPct >= 0 ? ' en ganancia' : ' en pérdida');
    if (!this.posDetail) return;

    this.posDetail.classList.remove('hidden');
    if (this.posEntry) this.posEntry.textContent = '$' + formatPrice(t.entryPrice);
    if (this.posSl) this.posSl.textContent = t.stopLoss !== null ? '$' + formatPrice(t.stopLoss) : '-';
    if (this.posTp) this.posTp.textContent = t.takeProfit !== null ? '$' + formatPrice(t.takeProfit) : '-';
    if (this.posPnl) {
      this.posPnl.textContent = (t.unrealizedPct >= 0 ? '+' : '') + t.unrealizedPct.toFixed(2) + '%';
      this.posPnl.className = t.unrealizedPct >= 0 ? 'text-neon-emerald font-bold' : 'text-neon-rose font-bold';
    }
  }
}
