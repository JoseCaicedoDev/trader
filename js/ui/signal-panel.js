// Signal Panel Component
// Layer 3 (UI Presentation)
//
// A reusable class that manages the checklist panel displaying live trend structures
// (VWAP, EMA alignment, Stochastic RSI, and open trade details).

class SignalPanel {
  /**
   * @param {HTMLElement} viewRoot - Cloned template root DOM element
   * @param {string} type - Strategy type ('wyckoff' or 'emacross')
   * @param {boolean} isEthTimeframe - Whether to show 2 decimal places for ETH price
   */
  constructor(viewRoot, type = 'wyckoff', isEthTimeframe = false) {
    this.viewRoot = viewRoot;
    this.type = type;
    this.isEthTimeframe = isEthTimeframe;

    // Common checklist items
    this.vwapDot = viewRoot.querySelector('.chk-vwap-dot');
    this.vwapText = viewRoot.querySelector('.chk-vwap-text');
    this.emaDot = viewRoot.querySelector('.chk-ema-dot');
    this.emaText = viewRoot.querySelector('.chk-ema-text');
    this.posDot = viewRoot.querySelector('.chk-position-dot');
    this.posText = viewRoot.querySelector('.chk-position-text');
    this.posDetail = viewRoot.querySelector('.signal-position-detail');

    // Strategy 1 specific items
    this.eventBadge = viewRoot.querySelector('.signal-event-badge');
    this.stochDot = viewRoot.querySelector('.chk-stoch-dot');
    this.stochText = viewRoot.querySelector('.chk-stoch-text');

    // Strategy 1 position details
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

    // 1. VWAP Check
    if (this.vwapDot && this.vwapText) {
      if (state.vwap !== null) {
        this.vwapDot.className = state.aboveVwap ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
        this.vwapText.textContent = (state.aboveVwap ? 'Precio arriba (alcista)' : 'Precio abajo (bajista)') +
          ' — $' + formatPrice(state.vwap, this.isEthTimeframe ? 2 : 0);
      } else {
        this.vwapDot.className = CSS_CLASSES.DOT_NEUTRAL;
        this.vwapText.textContent = 'Calculando...';
      }
    }

    // 2. EMA Structure Check
    if (this.emaDot && this.emaText) {
      if (state.bullishStructure !== null) {
        this.emaDot.className = state.bullishStructure ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
        if (this.type === 'wyckoff') {
          this.emaText.textContent = state.bullishStructure ? 'Estructura alcista (21>50)' : 'Estructura bajista (21<50)';
        } else if (this.isEthTimeframe) {
          this.emaText.textContent = state.bullishStructure ? 'EMA19 > EMA45 (alcista)' : 'EMA19 < EMA45 (bajista)';
        } else {
          this.emaText.textContent = state.bullishStructure ? 'EMA21 > EMA30 (alcista)' : 'EMA21 < EMA30 (bajista)';
        }
      } else {
        this.emaDot.className = CSS_CLASSES.DOT_NEUTRAL;
        this.emaText.textContent = 'Calculando...';
      }
    }

    // 3. Wyckoff Event & Stochastic RSI Check (Strategy 1 Only)
    if (this.type === 'wyckoff') {
      if (this.eventBadge) {
        if (state.lastEvent) {
          this.eventBadge.textContent = 'Evento detectado: ' + (EVENT_LABELS[state.lastEvent] || state.lastEvent);
          this.eventBadge.className = CSS_CLASSES.BADGE_EVENT_ACTIVE;
        } else {
          this.eventBadge.textContent = 'Sin evento Wyckoff activo';
          this.eventBadge.className = CSS_CLASSES.BADGE_EVENT_INACTIVE;
        }
      }

      if (this.stochDot && this.stochText) {
        if (state.stochK !== null) {
          const kStr = state.stochK.toFixed(0);
          if (state.stochOversold) {
            this.stochDot.className = CSS_CLASSES.DOT_OK;
            this.stochText.textContent = 'Sobrevendido (%K=' + kStr + ')';
          } else if (state.stochOverbought) {
            this.stochDot.className = CSS_CLASSES.DOT_OK;
            this.stochText.textContent = 'Sobrecomprado (%K=' + kStr + ')';
          } else {
            this.stochDot.className = CSS_CLASSES.DOT_NEUTRAL;
            this.stochText.textContent = 'Zona neutral (%K=' + kStr + ')';
          }
        } else {
          this.stochDot.className = CSS_CLASSES.DOT_NEUTRAL;
          this.stochText.textContent = 'Calculando...';
        }
      }
    }

    // 4. Open Position Checklist & Panel Details
    if (this.posDot && this.posText) {
      if (state.openTrade) {
        const t = state.openTrade;
        this.posDot.className = t.unrealizedPct >= 0 ? CSS_CLASSES.DOT_OK : CSS_CLASSES.DOT_BAD;
        this.posText.textContent = t.direction + (t.unrealizedPct >= 0 ? ' en ganancia' : ' en pérdida');
        
        if (this.posDetail) {
          this.posDetail.classList.remove('hidden');
          if (this.posEntry) this.posEntry.textContent = '$' + formatPrice(t.entryPrice);
          if (this.posSl) this.posSl.textContent = t.stopLoss !== null ? '$' + formatPrice(t.stopLoss) : '-';
          if (this.posTp) this.posTp.textContent = t.takeProfit !== null ? '$' + formatPrice(t.takeProfit) : '-';
          
          if (this.posPnl) {
            this.posPnl.textContent = (t.unrealizedPct >= 0 ? '+' : '') + t.unrealizedPct.toFixed(2) + '%';
            this.posPnl.className = t.unrealizedPct >= 0 ? 'text-neon-emerald font-bold' : 'text-neon-rose font-bold';
          }
        }
      } else {
        this.posDot.className = CSS_CLASSES.DOT_NEUTRAL;
        this.posText.textContent = 'Sin posición';
        if (this.posDetail) this.posDetail.classList.add('hidden');
      }
    }
  }
}
