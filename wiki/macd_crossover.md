---
title: "Cruces de MACD"
type: strategy
tags: [momentum, crossover, macd]
created: 2026-07-13
last_updated: 2026-07-13
---

# Cruces de MACD (MACD Signal Line Crossover)

Estrategia cuantitativa basada en el impulso y el impulso relativo de tendencias. Monitorea la convergencia/divergencia de medias móviles exponenciales para identificar puntos óptimos de aceleración de precios.

---

## 🛠️ Fundamento Matemático

1. **Línea MACD (MACD Line)**:
   $$MACDLine_t = EMA(12)_t - EMA(26)_t$$
2. **Línea de Señal (Signal Line)**:
   $$SignalLine_t = EMA(9)_{MACDLine, t}$$
3. **Histograma**:
   $$Histogram_t = MACDLine_t - SignalLine_t$$

### Reglas de Entrada y Salida:
- **Señal de Compra (Bullish Crossover)**: La línea MACD cruza de abajo hacia arriba a la línea de señal:
  $$MACDLine_{t-1} \le SignalLine_{t-1} \quad \text{y} \quad MACDLine_t > SignalLine_t$$
- **Señal de Venta (Bearish Crossover)**: La línea MACD cruza de arriba hacia abajo a la línea de señal:
  $$MACDLine_{t-1} \ge SignalLine_{t-1} \quad \text{y} \quad MACDLine_t < SignalLine_t$$

---

## 💻 Implementación en Código

Ubicada en la función `runMacdStrategy` de [app.js](file:///c:/Users/gira/Desktop/backtesting/app.js):
- Utiliza la función interna `calculateMACD`.
- Emplea `calculateEMAOfArray` para calcular la media exponencial de la línea MACD resultante.
- Ejecuta compras y ventas completas al cruzar la señal.

---

## 📊 Historial de Backtesting

*Pendiente de registro. Ejecuta simulaciones de MACD en el dashboard e integra los resultados aquí para actualizar la base de conocimientos.*
