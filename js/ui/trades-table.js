// Trades History Table Component
// Layer 3 (UI Presentation)
//
// A reusable component class that processes raw simulator trades arrays, 
// groups entries and exits into round-trips, and populates the history table 
// using DocumentFragment to prevent DOM layout thrashing.

class TradesTable {
  /**
   * @param {string} tbodyId - DOM ID of the table body to render into
   */
  constructor(tbodyId) {
    this.tbody = document.getElementById(tbodyId);
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

    // Pair entries and exits into roundtrips
    const roundTrips = [];
    let openEntry = null;

    trades.forEach(t => {
      if (t.type === 'BUY' || t.type === 'SHORT') {
        openEntry = t;
      } else if (openEntry) {
        roundTrips.push({ entry: openEntry, exit: t });
        openEntry = null;
      }
    });

    // Newest first
    const rows = [...roundTrips].reverse();
    if (openEntry) rows.unshift({ entry: openEntry, exit: null });

    const fragment = document.createDocumentFragment();

    rows.forEach(({ entry, exit }) => {
      const row = document.createElement('tr');
      row.className = CSS_CLASSES.ROW_BORDER;

      const entryEventLabel = eventLabels && eventLabels[entry.index] 
        ? (EVENT_LABELS[eventLabels[entry.index]] || eventLabels[entry.index]) 
        : '-';

      if (!exit) {
        row.innerHTML = `
          <td class="p-3">${directionBadge(entry.type)}</td>
          <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
          <td class="p-3"><span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-purple/15 text-neon-purple border border-neon-purple/20">${entryEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(entry.price)}</td>
          <td class="p-3 text-gray-500" colspan="3">Posición abierta (aún sin cerrar)</td>
          <td class="p-3 text-gray-500">-</td>
          <td class="p-3 text-gray-300 font-mono">-</td>
        `;
      } else {
        const exitEventLabel = eventLabels && eventLabels[exit.index] 
          ? (EVENT_LABELS[eventLabels[exit.index]] || eventLabels[exit.index]) 
          : '-';
          
        const sign = exit.pnl >= 0 ? '+' : '';
        const pnlCell = `${sign}$${formatPrice(exit.pnl)} (${sign}${exit.pnlPercent.toFixed(2)}%)`;
        const pnlClass = 'p-3 font-semibold font-mono ' + (exit.pnl >= 0 ? 'text-neon-emerald' : 'text-neon-rose');
        const exitBadgeClass = exit.pnl >= 0 ? CSS_CLASSES.BADGE_EXIT_WIN : CSS_CLASSES.BADGE_EXIT_LOSS;

        row.innerHTML = `
          <td class="p-3">${directionBadge(entry.type)}</td>
          <td class="p-3 text-gray-300">${formatDate(entry.time)}</td>
          <td class="p-3"><span class="inline-block px-2 py-0.5 rounded text-xs font-semibold text-center bg-neon-purple/15 text-neon-purple border border-neon-purple/20">${entryEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(entry.price)}</td>
          <td class="p-3 text-gray-300">${formatDate(exit.time)}</td>
          <td class="p-3"><span class="${exitBadgeClass}">${exitEventLabel}</span></td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(exit.price)}</td>
          <td class="${pnlClass}">${pnlCell}</td>
          <td class="p-3 text-gray-300 font-mono">$${formatPrice(exit.equity)}</td>
        `;
      }
      fragment.appendChild(row);
    });

    this.tbody.appendChild(fragment);
  }
}
