// Live Price Feed Wrapper
// Layer 2 (Infrastructure / Data Wrapper)
//
// A clean, parameter-driven WebSocket wrapper for Binance public kline streams
// that extends EventTarget. It does not touch the DOM or strategies directly,
// but emits events ('open', 'price', 'candleClose', 'close', 'error') for the app.

class LiveFeed extends EventTarget {
  /**
   * @param {string} symbol - Trading pair symbol (e.g. 'BTCUSDT')
   * @param {string} interval - Candle timeframe (e.g. '4h')
   */
  constructor(symbol, interval = '4h') {
    super();
    this.symbol = symbol.toLowerCase();
    this.interval = interval;
    this.socket = null;
  }

  /**
   * Opens the WebSocket connection and registers event listeners.
   */
  connect() {
    this.disconnect(); // Ensure clean starting state

    const streamUrl = `wss://stream.binance.com:9443/ws/${this.symbol}@kline_${this.interval}`;
    this.socket = new WebSocket(streamUrl);

    this.socket.addEventListener('open', () => {
      this.dispatchEvent(new CustomEvent('open'));
    });

    this.socket.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      const k = msg.k;
      if (!k) return;

      // Emit price tick update
      this.dispatchEvent(new CustomEvent('price', { detail: {
        time: Math.floor(k.t / 1000),
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        closed: k.x
      }}));

      // Emit closed candle event specifically
      if (k.x) {
        this.dispatchEvent(new CustomEvent('candleClose', { detail: k }));
      }
    });

    this.socket.addEventListener('close', () => {
      this.dispatchEvent(new CustomEvent('close'));
    });

    this.socket.addEventListener('error', (err) => {
      this.dispatchEvent(new CustomEvent('error', { detail: err }));
    });
  }

  /**
   * Safely closes the WebSocket connection.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
