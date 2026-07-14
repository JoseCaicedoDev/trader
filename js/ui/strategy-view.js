// Strategy View Controller
// Layer 3 (UI Presentation)
//
// A reusable component class that manages sub-tab switching (Chart, Equity, Trades) 
// and triggers responsive chart resizing when hidden DOM containers become visible.
// Also provides static methods to handle top-level strategy view switching.

class StrategyView {
  /**
   * @param {string} rootId - DOM ID of the strategy view container
   * @param {ChartManager} chartManager - Associated ChartManager instance
   */
  constructor(rootId, chartManager) {
    this.root = document.getElementById(rootId);
    this.chartManager = chartManager;
    this.tabButtons = this.root.querySelectorAll('.tab-btn');
    this.panels = this.root.querySelectorAll('[data-tab-panel]');
    
    this.setupTabs();
  }

  /**
   * Binds click listeners to tab buttons and manages layout panel visibility.
   */
  setupTabs() {
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Toggle button borders/active classes
        this.tabButtons.forEach(b => {
          const isActive = b === btn;
          b.classList.toggle('border-neon-cyan', isActive && this.root.id !== 'strategy-view-emacross');
          b.classList.toggle('border-neon-purple', isActive && this.root.id === 'strategy-view-emacross');
          b.classList.toggle('text-white', isActive);
          b.classList.toggle('border-transparent', !isActive);
          b.classList.toggle('text-gray-400', !isActive);
        });

        // Show/hide sub-tab panels
        this.panels.forEach(panel => {
          const isTarget = panel.dataset.tabPanel === target;
          panel.classList.toggle('hidden', !isTarget);
          panel.classList.toggle('flex', isTarget);
        });

        // Crucial: Trigger chart redraw when hidden container is shown
        if (this.chartManager) {
          requestAnimationFrame(() => this.chartManager.resize());
        }
      });
    });
  }

  /**
   * Helper static method to manage global strategy switching (tabs at the top header).
   * @param {Object} views - Mapping of view keys to StrategyView instances
   */
  static initStrategySwitcher(views) {
    const buttons = document.querySelectorAll('.strategy-tab-btn');
    const viewElements = {
      wyckoff: document.getElementById('strategy-view-wyckoff'),
      emacross: document.getElementById('strategy-view-emacross'),
      eth: document.getElementById('strategy-view-eth')
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.strategy;

        // Update header switcher tab styles
        buttons.forEach(b => {
          const isActive = b.dataset.strategy === target;
          b.className = isActive
            ? (target === 'wyckoff' ? CSS_CLASSES.STRATEGY_TAB_ACTIVE_WYCKOFF : CSS_CLASSES.STRATEGY_TAB_ACTIVE_CROSS)
            : CSS_CLASSES.STRATEGY_TAB_INACTIVE;
        });

        // Toggle root container visibility
        Object.entries(viewElements).forEach(([key, el]) => {
          if (el) {
            el.classList.toggle('hidden', key !== target);
            el.classList.toggle('flex', key === target);
          }
        });

        // Trigger resize on the active strategy's chart manager
        if (views[target] && views[target].chartManager) {
          requestAnimationFrame(() => views[target].chartManager.resize());
        }
      });
    });
  }
}
