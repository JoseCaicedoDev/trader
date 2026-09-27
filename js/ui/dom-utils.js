// DOM Utilities & Design Token Constants
// Layer 3 (UI Presentation Helpers)
//
// Pure presentation helpers, date formatting, price formatting, and design system classes.
// No business logic, no data fetching, no global state dependencies.

const EVENT_LABELS = Object.freeze({
  SPRING: 'Spring', 
  LPS: 'LPS', 
  SOS: 'SOS', 
  UTAD: 'UTAD', 
  SOW: 'SOW', 
  LPSY: 'LPSY',
  STOCH_EXIT: 'Cruce %K/%D', 
  STOP_LOSS: 'Stop Loss',
  TAKE_PROFIT: 'Take Profit',
  COUNTER_ON_TP: 'Contraria tras TP',
  EMA_CROSS_UP: 'Cruce Alcista EMA',
  EMA_CROSS_DOWN: 'Cruce Bajista EMA'
});

const CSS_CLASSES = Object.freeze({
  DOT_OK: 'w-2 h-2 rounded-full inline-block bg-neon-emerald shrink-0',
  DOT_BAD: 'w-2 h-2 rounded-full inline-block bg-neon-rose shrink-0',
  DOT_NEUTRAL: 'w-2 h-2 rounded-full inline-block bg-gray-600 shrink-0',
  
  DOT_LIVE_PULSE: 'w-2 h-2 rounded-full inline-block bg-neon-emerald shadow-[0_0_6px_#00e676] animate-pulse',
  DOT_LIVE_NEUTRAL: 'w-2 h-2 rounded-full inline-block bg-gray-500',
  DOT_LIVE_ERROR: 'w-2 h-2 rounded-full inline-block bg-neon-rose',
  
  DOT_SIGNAL_ACTIVE_WYCKOFF: 'w-1.5 h-1.5 rounded-full inline-block bg-neon-emerald animate-pulse',
  DOT_SIGNAL_ACTIVE_CROSS: 'w-1.5 h-1.5 rounded-full inline-block bg-neon-purple animate-pulse',
  DOT_SIGNAL_INACTIVE: 'w-1.5 h-1.5 rounded-full inline-block bg-gray-600',
  
  BADGE_EVENT_ACTIVE: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/20 w-fit',
  BADGE_EVENT_INACTIVE: 'text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-400 border border-white/8 w-fit',
  BADGE_EVENT_ENTRY: 'inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-purple/15 text-neon-purple border border-neon-purple/20',
  
  BADGE_DIRECTION_LONG: 'inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/20',
  BADGE_DIRECTION_SHORT: 'inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-rose/15 text-neon-rose border border-neon-rose/20',
  
  BADGE_EXIT_WIN: 'inline-block px-2 py-0.5 rounded text-xs font-semibold text-center border bg-neon-emerald/15 text-neon-emerald border-neon-emerald/20',
  BADGE_EXIT_LOSS: 'inline-block px-2 py-0.5 rounded text-xs font-semibold text-center border bg-neon-rose/15 text-neon-rose border-neon-rose/20',
  
  ROW_BORDER: 'border-b border-white/5 hover:bg-white/2 transition-colors duration-150',
  
  METRIC_UP: 'text-2xl font-bold tracking-tight tabular-nums text-neon-emerald drop-shadow-[0_0_8px_rgba(0,230,118,0.3)]',
  METRIC_DOWN: 'text-2xl font-bold tracking-tight tabular-nums text-neon-rose drop-shadow-[0_0_8px_rgba(255,23,68,0.3)]',
  
  STRATEGY_TAB_ACTIVE_WYCKOFF: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25 active-strategy-tab shrink-0 whitespace-nowrap snap-start',
  STRATEGY_TAB_ACTIVE_CROSS: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-neon-purple/15 text-neon-purple border border-neon-purple/25 active-strategy-tab shrink-0 whitespace-nowrap snap-start',
  // Momentum cards compose base + one tone. The tone tints the
  // card green/red only when RSI and MACD agree on direction, so confluence stands out.
  MOMENTUM_CARD: 'glass-card rounded-xl px-3 py-2.5 grid gap-1 content-start text-xs border',
  MOMENTUM_CARD_TONE_NEUTRAL: 'border-white/6',
  MOMENTUM_CARD_TONE_UP: 'border-neon-emerald/60 bg-gradient-to-br from-neon-emerald/20 to-transparent shadow-[0_0_14px_rgba(0,230,118,0.18)]',
  MOMENTUM_CARD_TONE_DOWN: 'border-neon-rose/60 bg-gradient-to-br from-neon-rose/20 to-transparent shadow-[0_0_14px_rgba(255,23,68,0.18)]',
  MOMENTUM_ASSET_ROW: 'grid gap-1.5',
  MOMENTUM_ASSET_HEADER: 'flex items-baseline gap-3 flex-wrap',
  MOMENTUM_ASSET_TITLE: 'text-base font-bold tracking-tight text-white',
  MOMENTUM_ASSET_PRICE: 'text-sm font-semibold tabular-nums text-neon-cyan',
  MOMENTUM_ASSET_NOTE: 'text-[11px] text-gray-500 font-medium',
  MOMENTUM_ASSET_CARDS: 'grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3',
  MOMENTUM_ASSET_ERROR: 'text-xs text-neon-rose font-medium',
  MOMENTUM_CARD_TITLE: 'text-sm font-bold text-white tracking-wide',
  MOMENTUM_CARD_ROW: 'grid grid-cols-[4.5rem_1fr_auto] items-center gap-2',
  MOMENTUM_HIST_DOTS_ROW: 'flex items-center justify-between text-xs',
  MOMENTUM_HIST_LABEL_GROUP: 'flex items-center gap-2 min-w-0',
  MOMENTUM_HIST_DOTS_CONTAINER: 'flex items-center gap-1 shrink-0',
  MOMENTUM_HIST_DOT_BASE: 'w-2.5 h-2.5 rounded-full shrink-0 transition-transform hover:scale-150 cursor-help',
  MOMENTUM_HIST_DOT_UP_GROW: 'bg-[#00e676] shadow-[0_0_6px_#00e676]',
  MOMENTUM_HIST_DOT_UP_FALL: 'bg-[#004d25] border border-[#00e676]/60',
  MOMENTUM_HIST_DOT_DOWN_GROW: 'bg-[#ff1744] shadow-[0_0_6px_#ff1744]',
  MOMENTUM_HIST_DOT_DOWN_FALL: 'bg-[#4d0010] border border-[#ff1744]/60',
  MOMENTUM_HIST_DOT_NEUTRAL: 'bg-white/20 border border-white/30',
  MOMENTUM_HIST_DOT_CURRENT: 'ring-1.5 ring-white/90 ring-offset-1 ring-offset-dark-sidebar/80 animate-pulse',
  // Shows how the histogram is derived (MACD line minus signal line), since unlike RSI its
  // value is in USD and has no fixed scale.
  MOMENTUM_CARD_DETAIL: 'text-[11px] text-gray-400 font-medium tabular-nums',
  MOMENTUM_CARD_NOTE: 'text-[11px] text-gray-500 font-medium',
  MOMENTUM_ROW_LABEL: 'text-gray-400',
  MOMENTUM_ROW_VALUE: 'font-bold tabular-nums text-white',
  MOMENTUM_TREND_UP: 'text-[10px] font-semibold text-neon-emerald whitespace-nowrap',
  MOMENTUM_TREND_DOWN: 'text-[10px] font-semibold text-neon-rose whitespace-nowrap',
  MOMENTUM_TREND_FLAT: 'text-[10px] font-semibold text-gray-400 whitespace-nowrap',
  MOMENTUM_BADGE_UP: 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neon-emerald/15 text-neon-emerald border border-neon-emerald/20 whitespace-nowrap',
  MOMENTUM_BADGE_DOWN: 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neon-rose/15 text-neon-rose border border-neon-rose/20 whitespace-nowrap',
  MOMENTUM_BADGE_NEUTRAL: 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/5 text-gray-300 border border-white/10 whitespace-nowrap',
  MOMENTUM_STATUS_OK: 'momentum-status text-xs text-gray-500 font-medium',
  MOMENTUM_STATUS_ERROR: 'momentum-status text-xs text-neon-rose font-medium',

  STRATEGY_TAB_INACTIVE: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-white/5 text-gray-400 border border-white/8 hover:text-gray-200 shrink-0 whitespace-nowrap snap-start'
});

function formatDate(time) {
  return new Date(time * 1000).toLocaleString(undefined, { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

function directionBadge(entryType) {
  return entryType === 'BUY'
    ? `<span class="${CSS_CLASSES.BADGE_DIRECTION_LONG}">LONG</span>`
    : `<span class="${CSS_CLASSES.BADGE_DIRECTION_SHORT}">SHORT</span>`;
}

function formatPrice(value, decimals = 2) {
  return value.toLocaleString(undefined, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}
