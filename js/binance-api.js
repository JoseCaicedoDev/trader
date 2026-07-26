// Binance public REST API client. No dependencies.
async function fetchBinanceKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API respondió con código ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

// Binance returns at most 1,000 candles per request. Fetch a continuous history by
// advancing the start timestamp after each full page; the caller still receives the
// same kline shape as fetchBinanceKlines.
async function fetchBinanceKlinesSince(symbol, interval, startTime, endTime = Date.now()) {
  const klines = [];
  let cursor = startTime;

  while (cursor <= endTime) {
    const params = new URLSearchParams({
      symbol,
      interval,
      limit: '1000',
      startTime: String(cursor),
      endTime: String(endTime)
    });
    const response = await fetch(`https://api.binance.com/api/v3/klines?${params}`);
    if (!response.ok) {
      throw new Error(`Binance API respondió con código ${response.status}: ${response.statusText}`);
    }

    const page = await response.json();
    if (!page.length) break;
    klines.push(...page);
    if (page.length < 1000) break;

    // Binance timestamps each candle by its opening time. Adding one millisecond
    // prevents duplicating the last candle without assuming a particular interval.
    cursor = page[page.length - 1][0] + 1;
  }

  return klines;
}
