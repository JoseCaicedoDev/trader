---
title: "Mejoras de Acierto y Retorno — Análisis de Estrategias"
type: analysis
tags: [optimization, wyckoff, ema-cross, risk-management, btc, 4h]
created: 2026-07-13
last_updated: 2026-07-13
---

# Mejoras de Acierto y Retorno

Análisis de los vectores de mejora concretos para las dos estrategias implementadas en el backtester:
**Wyckoff Unificada** ([strategy-wyckoff.js](file:///c:/Users/gira/Desktop/backtesting/js/strategy-wyckoff.js)) y
**VWAP + EMA Cross** ([strategy-emacross.js](file:///c:/Users/gira/Desktop/backtesting/js/strategy-emacross.js)).

Métricas actuales de referencia (ventana de ~1000 velas 4h BTC/USDT):

| Estrategia | Acierto | Retorno | Drawdown Máx. |
|---|---|---|---|
| Wyckoff Unificada | ~78.5% | ~10–15% | ~5% |
| VWAP+EMA Cross | 76.5% | +31.4% | −4.37% |

---

## 1. 📐 Calidad de Entrada: Reducir Señales Falsas

### 1.1 Filtro de Volumen Relativo en Spring/UTAD (Wyckoff)

**Problema actual**: Un Spring se detecta con cualquier wick por debajo del rango + cierre alcista. No se verifica si el volumen del Spring es *comparativamente alto* respecto a las velas del rango, lo que distingue un Spring genuino (pánico de retail absorbido institucionalmente) de un deslizamiento aleatorio.

**Mejora propuesta** en [strategy-wyckoff.js](file:///c:/Users/gira/Desktop/backtesting/js/strategy-wyckoff.js) `detectWyckoffEvents()`:
```javascript
const isHighVolSpring = c.volume > volSma[i] * 1.2; // volumen sobre la media
if (c.low < rangeLow[i] && c.close > rangeLow[i] && c.close > c.open && isHighVolSpring) {
  events[i] = 'SPRING';
}
```
*Lógica*: Un Spring auténtico muestra volumen elevado porque las instituciones absorben el pánico vendedor. Bajo volumen en la penetración = movimiento sin fuerza institucional detrás.

---

### 1.2 Confirmación con Body-to-Range Ratio

**Problema actual**: `minRejection = 0.7` no penaliza velas de rango muy pequeño (dojis micro que pasan el filtro por tener la mínima mecha).

**Mejora propuesta**: Añadir un requisito de rango absoluto mínimo en ATRs:
```javascript
const minCandleSize = atr[i] * 0.3; // al menos 30% de la ATR actual
const candleSizeOk = range >= minCandleSize;
if (score >= 1 && strongCandle && trendOk && candleSizeOk) { ... }
```
*Efecto esperado*: Elimina señales en rangos de baja volatilidad donde el fakeout es estructural.

---

### 1.3 Score >= 2 en LPS/LPSY (Wyckoff) — PRIORIDAD ALTA

**Problema actual**: LPS y LPSY exigen `score >= 1`, igual que Spring/UTAD. Pero LPS/LPSY son entradas de continuación (Fase D), más propensas a trampas en mercados que no terminan de romper.

**Mejora propuesta**:
```javascript
const minScore = (event === 'LPS' || event === 'LPSY') ? 2 : 1;
if (score >= minScore && strongCandle && trendOk) { ... }
```
*Trade-off*: Menos trades LPS/LPSY, pero con mayor tasa de acierto. Una sola línea de cambio con impacto directo en la win rate.

---

## 2. 🎯 Gestión de SL/TP: Mejorar el Retorno por Trade

### 2.1 Trailing Stop Activado tras 1:1 R:R

**Problema actual**: El stop es fijo desde la entrada. Una vez que el trade avanza más de 1× el riesgo inicial, el trailing debería activarse para proteger la ganancia.

**Mejora en [simulator.js](file:///c:/Users/gira/Desktop/backtesting/js/simulator.js)**:
```javascript
// Añadir parámetro: activeTrailingDist (null = sin trailing)
// Después de la apertura de posición, calcular: trailingDist = entryRisk * 0.8
// En cada vela, actualizar el stop si el precio lo supera hacia arriba:
if (direction === 'LONG' && activeTrailingDist !== null) {
  const newTrail = candle.high - activeTrailingDist;
  if (newTrail > activeStop) activeStop = newTrail; // sube el stop, nunca baja
}
```
*Impacto esperado*: Convierte trades que hoy llegan a BE o SL después de tocar 1:1 en trades ganadores pequeños.

---

### 2.2 R:R Mínimo de 1.5 como Filtro de Entrada — PRIORIDAD ALTA

**Problema actual**: No hay validación del R:R calculado antes de entrar. Si el SL-ATR es muy amplio y el target es cercano, el R:R puede ser < 1:1.

**Mejora propuesta**:
```javascript
const riskDist = close - stopLossLevels[i];       // para LONG
const rewardDist = takeProfitLevels[i] - close;
if (rewardDist / riskDist < 1.5) continue; // omitir señal si R:R insuficiente
```
*Efecto*: Alineado con los "9 Test de Compra" del método Wyckoff (R:R > 3:1 en el método clásico; 1.5 es el mínimo operativo razonable para 4h).

---

### 2.3 Take Profit Escalonado — Parcial en TP1, resto corre

**Estructura lógica**:
- **TP1** (50% posición): `close + (fullTarget - close) * 0.50` — asegura ganancia
- **TP2** (50% restante): siguiente resistencia estructural mayor, o trailing stop
- **SL** del TP2: se mueve a breakeven una vez ejecutado TP1

> [!NOTE]
> El simulador actual no soporta cierres parciales. Requiere refactorizar `openPosition`/`closePosition` para manejar `units` fraccionales y múltiples exits por trade.

---

## 3. 📊 Filtro de Régimen de Volatilidad

### 3.1 ATR Percentile — No operar en volatilidad extrema

**Problema actual**: La estrategia no diferencia entre periodos de volatilidad normal y crisis (cascadas de liquidación). En esos eventos, los Springs fallan porque el precio no recupera.

**Implementación en [indicators.js](file:///c:/Users/gira/Desktop/backtesting/js/indicators.js)**:
```javascript
function calculateATRPercentile(atr, i, window = 100, percentile = 80) {
  const slice = atr.slice(Math.max(0, i - window), i).filter(v => v !== null);
  slice.sort((a, b) => a - b);
  return slice[Math.floor(slice.length * percentile / 100)] ?? null;
}

// Filtro en la señal de entrada:
const atrP80 = calculateATRPercentile(atr, i);
const volatilityOk = atrP80 === null || atr[i] <= atrP80 * 1.5;
```
*Lógica*: En BTC, los Springs de mayor éxito ocurren en rangos con volatilidad estable, no durante picos de pánico donde el wick de liquidación es demasiado profundo.

---

### 3.2 Bandas de Bollinger como Gate de Régimen (EMA Cross)

Sólo operar si el precio NO está en una expansión extrema. Los cruces de EMA en medio de una vela de expansión extrema generalmente son trampas.

```javascript
// Añadir a indicators.js:
function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const bands = new Array(data.length).fill(null);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0, sq = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close;
    const mean = sum / period;
    for (let j = i - period + 1; j <= i; j++) sq += (data[j].close - mean) ** 2;
    const std = Math.sqrt(sq / period);
    bands[i] = { upper: mean + stdDev * std, middle: mean, lower: mean - stdDev * std, std };
  }
  return bands;
}

// Filtro en runEmaCrossStrategy():
const bb = calculateBollingerBands(data, 20, 2);
const inBBRange = !bb[i] || Math.abs(data[i].close - bb[i].middle) < bb[i].std * 2.5;
if ((currAlign === 1 && prevAlign !== 1) && inBBRange) { ... }
```

---

## 4. 🕐 Confirmación Multi-Timeframe (MTF)

### Concepto

Actualmente ambas estrategias operan únicamente en 4h. El método Wyckoff clásico exige validar que la **tendencia del timeframe superior** (diario) esté alineada con la dirección del trade.

**En la práctica para el backtester**:
- Cargar 2 datasets paralelos: `1000 velas 4h` + `200 velas 1d` desde Binance
- Gate adicional: `close_4h > EMA50_daily` para LONGs, `close_4h < EMA50_daily` para SHORTs

```javascript
// En main.js, al cargar datos:
const dailyData = await fetchBinanceKlines('BTCUSDT', '1d', 200);
const ema50Daily = calculateEMA(dailyData, 50);
const dailyTrend = ema50Daily[ema50Daily.length - 1];
const dailyBullish = data4h[data4h.length - 1].close > dailyTrend;
// Pasar dailyBullish como parámetro adicional a las estrategias
```

> [!IMPORTANT]
> Sincronizar correctamente los timestamps: cada vela 4h debe compararse contra la vela diaria cuyo `closeTime >= openTime_4h`.

---

## 5. 📈 Momentum Scoring Mejorado (Wyckoff)

### 5.1 Añadir RSI Clásico como 4° Punto de Score

StochRSI y RSI clásico no son idénticos — el StochRSI reacciona mucho más rápido. Usar ambos filtra señales donde el StochRSI ya rebotó pero el RSI aún no confirma recuperación.

```javascript
// calculateRSI() ya existe en indicators.js
const rsi14 = calculateRSI(data, 14);

// Score BULLISH (Spring/LPS):
if (rsi14[i] !== null && rsi14[i] < 45) score++;   // RSI en zona baja-neutral

// Score BEARISH (UTAD/LPSY):
if (rsi14[i] !== null && rsi14[i] > 55) score++;   // RSI en zona alta-neutral
```

---

### 5.2 Umbral de Score Dinámico por Evento

| Evento | Score Mínimo Actual | Score Mínimo Propuesto |
|---|---|---|
| Spring / UTAD | 1 | 1 (mantener, son eventos raros) |
| LPS / LPSY | 1 | 2 (mayor selectividad) |
| Fallback STOCH_EXIT | n/a | Solo si `abs(k[i] - d[i]) > 5` |

El último punto evita salidas por microcruce del StochRSI en mercados laterales.

---

## 6. 💰 Gestión de Posición y Sizing

### 6.1 Sizing Proporcional al Score

**Concepto actual**: Siempre se invierte el 100% del capital disponible.
**Mejora**: Escalar el tamaño según el score de confluencia:

| Score | % Capital a Arriesgar |
|---|---|
| 1 | 33% |
| 2 | 66% |
| 3+ | 100% |

> [!WARNING]
> Requiere modificar `openPosition(i, dir, sizeFraction)` en [simulator.js](file:///c:/Users/gira/Desktop/backtesting/js/simulator.js). La curva de equity cambia profundamente y debe re-validarse desde cero.

---

### 6.2 Circuit Breaker — Pausa tras Drawdown Reciente

```javascript
// Parar de operar si el equity cayó > 5% respecto al máximo de las últimas 24 velas:
const recentPeak = Math.max(...equityCurve.slice(-24).map(e => e.value));
if ((recentPeak - currentEquity) / recentPeak > 0.05) skipSignal = true;
```

---

## 7. 🗺️ Mapa de Prioridades y Riesgo de Overfitting

| # | Mejora | Impacto Esperado | Riesgo Overfitting | Complejidad |
|---|---|---|---|---|
| 1 | Score >= 2 en LPS/LPSY | ↑ Acierto | Bajo | Mínima |
| 2 | Filtro R:R >= 1.5 | ↑ Retorno/trade | Bajo | Mínima |
| 3 | Filtro ATR Percentile | ↓ Drawdown | Bajo-Medio | Baja |
| 4 | Volumen en Spring | ↑ Calidad entrada | Medio | Baja |
| 5 | Trailing Stop | ↑ Retorno total | Bajo | Media |
| 6 | RSI clásico en score | ↑ Acierto | Medio | Baja |
| 7 | Multi-Timeframe Daily | Impacto estructural | Medio | Alta |
| 8 | TP Escalonado | ↑ Captura Fase E | Bajo | Alta |
| 9 | Sizing por Score | Optimización capital | Alto | Alta |

> [!CAUTION]
> Implementar más de 2–3 mejoras simultáneamente sin validar cada una por separado en la ventana actual **y** en una ventana out-of-sample es la fuente clásica de **overfitting**. El código ya advierte esto en los comentarios de [config.js](file:///c:/Users/gira/Desktop/backtesting/js/config.js).

---

## 8. 🔗 Referencias Cruzadas

- [Método Wyckoff](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md) — Fundamentos teóricos de Spring, LPS, SOS.
- [Smart Money Concepts](file:///c:/Users/gira/Desktop/backtesting/wiki/conceptos_smart_money.md) — Order Blocks como soporte de niveles S/R.
- [Cruce de Medias](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) — Base de la estrategia VWAP+EMA Cross.
- [Bandas de Bollinger](file:///c:/Users/gira/Desktop/backtesting/wiki/bandas_de_bollinger.md) — Filtro de régimen de volatilidad.
