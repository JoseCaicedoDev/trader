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
  
  STRATEGY_TAB_ACTIVE_WYCKOFF: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/25 active-strategy-tab',
  STRATEGY_TAB_ACTIVE_CROSS: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-neon-purple/15 text-neon-purple border border-neon-purple/25 active-strategy-tab',
  STRATEGY_TAB_INACTIVE: 'strategy-tab-btn flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-lg bg-white/5 text-gray-400 border border-white/8 hover:text-gray-200'
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
