// Momentum View (RSI + MACD, multi-asset × multi-timeframe)
// Layer 3 (UI Presentation)
//
// One row per asset, each with a summary card per timeframe (RSI value/direction/zone, MACD
// histogram and how it's derived). A card is tinted green/red when RSI and MACD agree.
// Receives precomputed snapshots from main.js — never fetches data or computes indicators itself.
// Depends on: CSS_CLASSES, formatPrice (dom-utils.js). Exported API: class MomentumView.

class MomentumView {
  /**
   * @param {HTMLElement} root - The momentum view section
   * @param {Array<{symbol: string, label: string, decimals: number, priceDecimals: number, note?: string}>} assets
   * @param {Array<{interval: string, label: string}>} timeframes - Timeframes in display order
   */
  constructor(root, assets, timeframes) {
    this.root = root;
    this.accentColor = 'cyan';
    this.assets = assets;
    this.timeframes = timeframes;
    this.statusEl = root.querySelector('.momentum-status');
    this.rows = this.mountAssetRows(root.querySelector('.momentum-assets'));
  }

  /**
   * Redraws one asset's row.
   * @param {string} symbol - Asset symbol as configured (e.g. 'BTCUSDT')
   * @param {Object<string, {rsi: Array, macd: Object, lastClose: number}>} snapshots - Keyed by interval
   */
  updateAsset(symbol, snapshots) {
    const row = this.rows[symbol];
    const lastClose = Object.values(snapshots)[0].lastClose;
    row.priceEl.textContent = `$${formatPrice(lastClose, row.asset.priceDecimals)}`;
    const fragment = document.createDocumentFragment();
    this.timeframes.forEach(tf => fragment.appendChild(this.buildCard(tf, snapshots[tf.interval], row.asset)));
    row.cardsEl.replaceChildren(fragment);
  }

  /** Marks one asset's row as failed without affecting the others. */
  setAssetError(symbol, message) {
    const row = this.rows[symbol];
    row.cardsEl.replaceChildren(buildTextEl('span', CSS_CLASSES.MOMENTUM_ASSET_ERROR, message));
  }

  /** Shows a loading, success or error message in the status line. */
  setStatus(message, isError = false) {
    this.statusEl.textContent = message;
    this.statusEl.className = isError ? CSS_CLASSES.MOMENTUM_STATUS_ERROR : CSS_CLASSES.MOMENTUM_STATUS_OK;
  }

  /** Switcher hook; cards are plain DOM that reflow on their own, so nothing to resize. */
  resize() {}

  mountAssetRows(container) {
    const rows = {};
    this.assets.forEach(asset => {
      const section = buildTextEl('section', CSS_CLASSES.MOMENTUM_ASSET_ROW, '');
      const header = buildTextEl('header', CSS_CLASSES.MOMENTUM_ASSET_HEADER, '');
      const priceEl = buildTextEl('span', CSS_CLASSES.MOMENTUM_ASSET_PRICE, '—');
      header.append(buildTextEl('h2', CSS_CLASSES.MOMENTUM_ASSET_TITLE, `${asset.label}/USDT`), priceEl);
      if (asset.note) header.append(buildTextEl('span', CSS_CLASSES.MOMENTUM_ASSET_NOTE, asset.note));
      const cardsEl = buildTextEl('div', CSS_CLASSES.MOMENTUM_ASSET_CARDS, '');
      section.append(header, cardsEl);
      container.appendChild(section);
      rows[asset.symbol] = { asset, priceEl, cardsEl };
    });
    return rows;
  }

  buildCard(tf, snapshot, asset) {
    const card = buildTextEl('article', '', '');
    card.append(buildTextEl('span', CSS_CLASSES.MOMENTUM_CARD_TITLE, tf.label));
    const reading = snapshot && readMomentum(snapshot);
    if (!reading) {
      card.className = `${CSS_CLASSES.MOMENTUM_CARD} ${CSS_CLASSES.MOMENTUM_CARD_TONE_NEUTRAL}`;
      card.append(buildTextEl('span', CSS_CLASSES.MOMENTUM_CARD_NOTE, 'Sin historial suficiente'));
      return card;
    }
    card.className = `${CSS_CLASSES.MOMENTUM_CARD} ${CSS_CLASSES[`MOMENTUM_CARD_TONE_${reading.confluence.toUpperCase()}`]}`;
    card.append(
      buildRow('RSI', buildRsiValue(reading.rsi, reading.rsiChange), reading.rsiZone),
      buildMacdRow('MACD', reading.macdBars, reading.macdBias, asset.decimals),
      buildTextEl('span', CSS_CLASSES.MOMENTUM_CARD_NOTE, reading.macdNote)
    );
    return card;
  }
}

// Plain-language reading of the latest values, so each card answers "what is momentum doing
// on this timeframe" without the user having to interpret raw numbers. Returns null when the
// asset doesn't have enough candles yet for RSI(14) and MACD(12, 26, 9).
function readMomentum({ rsi, macd }) {
  const last = rsi.length - 1;
  const hist = macd.histogram[last];
  const prevHist = macd.histogram[last - 1];
  if (last < 1 || rsi[last] === null || rsi[last - 1] === null || hist == null || prevHist == null) return null;
  const crossed = Math.sign(prevHist) !== Math.sign(hist);
  // The card is tinted only when the RSI zone has a direction and it matches the MACD
  // histogram's sign; an RSI in the 40–65 neutral band never tints the card.
  const zone = rsiZone(rsi[last]);
  const macdDirection = hist >= 0 ? 'up' : 'down';

  // Last 6 bars of the MACD histogram, from oldest (offset 5) to current forming candle (offset 0).
  const macdBars = [];
  const barCount = 6;
  const startIdx = Math.max(1, last - barCount + 1);
  for (let idx = startIdx; idx <= last; idx++) {
    const h = macd.histogram[idx];
    const ph = macd.histogram[idx - 1];
    const offset = last - idx;
    macdBars.push({
      offset,
      isCurrent: offset === 0,
      label: offset === 0 ? 'ACT' : `-${offset}`,
      tooltipLabel: offset === 0 ? 'Vela actual (en curso)' : `Hace ${offset} vela${offset > 1 ? 's' : ''}`,
      hist: h,
      prevHist: ph,
      state: classifyMacdBar(h, ph)
    });
  }
  while (macdBars.length < barCount) {
    const missingOffset = barCount - macdBars.length;
    macdBars.unshift({
      offset: missingOffset,
      isCurrent: false,
      label: `-${missingOffset}`,
      tooltipLabel: `Hace ${missingOffset} velas`,
      hist: null,
      prevHist: null,
      state: classifyMacdBar(null, null)
    });
  }

  return {
    confluence: zone.tone === macdDirection ? macdDirection : 'neutral',
    rsi: rsi[last],
    rsiChange: rsi[last] - rsi[last - 1],
    rsiZone: zone,
    histogram: hist,
    macdLine: macd.macd[last],
    signal: macd.signal[last],
    macdBias: hist >= 0 ? { text: 'Alcista', tone: 'up' } : { text: 'Bajista', tone: 'down' },
    macdBars,
    macdNote: crossed
      ? `Cruce ${hist >= 0 ? 'alcista' : 'bajista'} en la última vela`
      : `Momentum ${Math.abs(hist) >= Math.abs(prevHist) ? 'creciente' : 'decreciente'}`
  };
}

// 4-color MACD histogram acceleration classification (TradingView standard):
// - Positive & growing: bright green (accelerating bullish)
// - Positive & falling: dark green (decelerating bullish)
// - Negative & falling: bright red (accelerating bearish)
// - Negative & rising: dark red (decelerating / braking bearish)
function classifyMacdBar(hist, prevHist) {
  if (hist === null || prevHist === null || hist === undefined || prevHist === undefined) {
    return {
      type: 'neutral',
      description: 'Sin datos',
      cssClass: CSS_CLASSES.MOMENTUM_HIST_DOT_NEUTRAL
    };
  }
  if (hist >= 0) {
    if (hist >= prevHist) {
      return {
        type: 'up_grow',
        description: 'Alcista acelerando',
        cssClass: CSS_CLASSES.MOMENTUM_HIST_DOT_UP_GROW
      };
    } else {
      return {
        type: 'up_fall',
        description: 'Alcista desacelerando',
        cssClass: CSS_CLASSES.MOMENTUM_HIST_DOT_UP_FALL
      };
    }
  } else {
    if (hist <= prevHist) {
      return {
        type: 'down_grow',
        description: 'Bajista acelerando',
        cssClass: CSS_CLASSES.MOMENTUM_HIST_DOT_DOWN_GROW
      };
    } else {
      return {
        type: 'down_fall',
        description: 'Bajista frenando',
        cssClass: CSS_CLASSES.MOMENTUM_HIST_DOT_DOWN_FALL
      };
    }
  }
}

function buildMacdRow(label, macdBars, badge, decimals) {
  const row = buildTextEl('div', CSS_CLASSES.MOMENTUM_HIST_DOTS_ROW, '');
  const leftGroup = buildTextEl('div', CSS_CLASSES.MOMENTUM_HIST_LABEL_GROUP, '');
  leftGroup.append(
    buildTextEl('span', CSS_CLASSES.MOMENTUM_ROW_LABEL, label),
    buildMacdDots(macdBars, decimals)
  );
  const badgeEl = buildTextEl('span', CSS_CLASSES[`MOMENTUM_BADGE_${badge.tone.toUpperCase()}`], badge.text);
  row.append(leftGroup, badgeEl);
  return row;
}

function buildMacdDots(bars, decimals) {
  const container = buildTextEl('div', CSS_CLASSES.MOMENTUM_HIST_DOTS_CONTAINER, '');
  bars.forEach(bar => {
    const ringClass = bar.isCurrent ? ` ${CSS_CLASSES.MOMENTUM_HIST_DOT_CURRENT}` : '';
    const dot = buildTextEl(
      'span',
      `${CSS_CLASSES.MOMENTUM_HIST_DOT_BASE} ${bar.state.cssClass}${ringClass}`,
      ''
    );
    const histFormatted = bar.hist !== null && bar.hist !== undefined ? formatPrice(bar.hist, decimals) : '—';
    dot.title = `${bar.tooltipLabel}: Hist. ${histFormatted} (${bar.state.description})`;
    container.appendChild(dot);
  });
  return container;
}

// Overbought/oversold are the extreme ends of a bullish/bearish reading, so they share the
// direction (and color) of Alcista/Bajista; 40–65 is a wide dead zone so only clear momentum counts.
function rsiZone(value) {
  if (value >= 70) return { text: 'Sobrecompra', tone: 'up' };
  if (value >= 65) return { text: 'Alcista', tone: 'up' };
  if (value > 40) return { text: 'Neutral', tone: 'neutral' };
  if (value > 30) return { text: 'Bajista', tone: 'down' };
  return { text: 'Sobreventa', tone: 'down' };
}

function buildRow(label, valueEl, badge) {
  const row = buildTextEl('span', CSS_CLASSES.MOMENTUM_CARD_ROW, '');
  row.append(
    buildTextEl('span', CSS_CLASSES.MOMENTUM_ROW_LABEL, label),
    valueEl,
    buildTextEl('span', CSS_CLASSES[`MOMENTUM_BADGE_${badge.tone.toUpperCase()}`], badge.text)
  );
  return row;
}

// RSI value plus an arrow and the change vs. the previous candle, so the card shows where
// the RSI is heading and not only where it is.
function buildRsiValue(value, change) {
  const el = buildTextEl('span', CSS_CLASSES.MOMENTUM_ROW_VALUE, formatPrice(value, 1));
  const trend = buildTextEl('span', ...rsiTrendStyle(change));
  trend.title = 'Cambio del RSI respecto a la vela anterior';
  el.append(' ', trend);
  return el;
}

// Changes that round to 0,0 are shown as flat rather than a misleading ▼ −0,0.
function rsiTrendStyle(change) {
  const magnitude = formatPrice(Math.abs(change), 1);
  if (Math.abs(change) < 0.05) return [CSS_CLASSES.MOMENTUM_TREND_FLAT, `► ${magnitude}`];
  return change > 0
    ? [CSS_CLASSES.MOMENTUM_TREND_UP, `▲ +${magnitude}`]
    : [CSS_CLASSES.MOMENTUM_TREND_DOWN, `▼ −${magnitude}`];
}

function buildTextEl(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}
