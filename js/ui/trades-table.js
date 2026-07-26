// Trades History Table Component
// Layer 3 (UI Presentation)
//
// A reusable component class that processes raw simulator trades arrays, 
// groups entries and exits into round-trips, and populates the history table 
// using DocumentFragment to prevent DOM layout thrashing.

class TradesTable {
  /**
   * @param {HTMLElement} viewRoot - Cloned template root DOM element
   */
  constructor(viewRoot) {
    this.tbody = viewRoot.querySelector('.trades-table-body');
  }

  /**
   * Re-renders trades table with paired entry-exit roundtrips.
   * @param {Array<Object>} trades - Simulator trades array (alternates BUY/SHORT and SELL/COVER)
   * @param {Array<string>} eventLabels - Entry/exit labels corresponding to candle indices
   */
  render(trades, eventLabels) {
    if (!this.tbody) return;
    this.tbody.innerHTML = '';

    if (!trades || trades.length === 0) {
      this.tbody.innerHTML = `
        <tr class="${CSS_CLASSES.ROW_BORDER}">
          <td colspan="9" class="text-center text-gray-500 py-8">
            No se ejecutaron transacciones con los parámetros dados.
          </td>
        </tr>
      `;
      return;
    }

    // Pair entries and exits into roundtrips, PER BOOK. A strategy can run a second book alongside
    // the main one (the counter-on-take-profit book), so two positions may be open at the same time;
    // a single interleaved walk would pair one book's entry with the other's exit and produce rows
    // where, say, a LONG "profits" while exiting below its entry price.
    const openByBook = new Map();
    const roundTrips = [];

    trades.forEach(t => {
      const book = t.book || 'strategy';
      if (t.type === 'BUY' || t.type === 'SHORT') {
        openByBook.set(book, t);
      } else {
        const entry = openByBook.get(book);
        if (entry) {
          roundTrips.push({ entry, exit: t });
          openByBook.delete(book);
        }
      }
    });

    // Newest first, with any still-open position on top
    const rows = roundTrips.sort((a, b) => b.exit.time - a.exit.time || b.exit.index - a.exit.index);
    for (const entry of openByBook.values()) rows.unshift({ entry, exit: null });

    const fragment = document.createDocumentFragment();

    rows.forEach(({ entry, exit }) => {
      const row = document.createElement('tr');
      row.className = CSS_CLASSES.ROW_BORDER;

      // A trade may carry its own label — the counter book shares candle indices with the strategy's
      // own exits, so the per-candle array cannot tell the two apart. Prefer the trade's when set.
      const entryCode = entry.eventCode || (eventLabels ? eventLabels[entry.index] : null);
      const entryEventLabel = entryCode ? (EVENT_LABELS[entryCode] || entryCode) : '-';

      if (!exit) {
        row.innerHTML = `
          <td class="p-3">${directionBadge(entry.type)}</td>
          <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
          <td class="p-3"><span class="${CSS_CLASSES.BADGE_EVENT_ENTRY}">${entryEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(entry.price)}</td>
          <td class="p-3 text-gray-500" colspan="3">Posición abierta (aún sin cerrar)</td>
          <td class="p-3 text-gray-500">-</td>
          <td class="p-3 text-gray-300 font-mono">-</td>
        `;
      } else {
        const exitCode = exit.eventCode || (eventLabels ? eventLabels[exit.index] : null);
        const exitEventLabel = exitCode ? (EVENT_LABELS[exitCode] || exitCode) : '-';
          
        const sign = exit.pnl >= 0 ? '+' : '';
        const pnlCell = `${sign}$${formatPrice(exit.pnl)} (${sign}${exit.pnlPercent.toFixed(2)}%)`;
        const pnlClass = 'p-3 font-semibold font-mono ' + (exit.pnl >= 0 ? 'text-neon-emerald' : 'text-neon-rose');
        const exitBadgeClass = exit.pnl >= 0 ? CSS_CLASSES.BADGE_EXIT_WIN : CSS_CLASSES.BADGE_EXIT_LOSS;

        row.innerHTML = `
          <td class="p-3">${directionBadge(entry.type)}</td>
          <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
          <td class="p-3"><span class="${CSS_CLASSES.BADGE_EVENT_ENTRY}">${entryEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(entry.price)}</td>
          <td class="p-3 text-gray-300">${formatDate(exit.time)}</td>
          <td class="p-3"><span class="${exitBadgeClass}">${exitEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(exit.price)}</td>
          <td class="${pnlClass}">${pnlCell}</td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(exit.accountEquity !== undefined ? exit.accountEquity : exit.equity)}</td>
        `;
      }
      fragment.appendChild(row);
    });

    this.tbody.appendChild(fragment);
  }
}
