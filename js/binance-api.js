// Binance public REST API client. No dependencies.
async function fetchBinanceKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API respondió con código ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}
