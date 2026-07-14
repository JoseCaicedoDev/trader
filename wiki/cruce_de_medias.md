---
title: "Cruce de Medias Móviles"
type: strategy
tags: [trend-following, moving-average, btc]
created: 2026-07-13
last_updated: 2026-07-13
---

# Cruce de Medias Móviles (EMA/SMA Crossover)

Estrategia cuantitativa basada en el seguimiento de tendencias. Consiste en monitorear dos medias móviles calculadas sobre los precios de cierre (una media rápida de corto plazo y una media lenta de largo plazo).

---

## 🛠️ Fundamento Matemático

1. **Media Móvil Simple (SMA)**:
   $$SMA_t = \frac{1}{n} \sum_{i=0}^{n-1} Close_{t-i}$$
2. **Media Móvil Exponencial (EMA)**:
   $$EMA_t = Close_t \cdot \alpha + EMA_{t-1} \cdot (1 - \alpha)$$
   Donde el multiplicador es $\alpha = \frac{2}{periodo + 1}$.

### Reglas de Entrada y Salida:
- **Señal de Compra (Golden Cross)**: La media móvil rápida cruza de abajo hacia arriba a la media móvil lenta:
  $$Fast_{t-1} \le Slow_{t-1} \quad \text{y} \quad Fast_t > Slow_t$$
- **Señal de Venta (Death Cross)**: La media móvil rápida cruza de arriba hacia abajo a la media móvil lenta:
  $$Fast_{t-1} \ge Slow_{t-1} \quad \text{y} \quad Fast_t < Slow_t$$

---

## 💻 Implementación en Código

Ubicada en la función `runMaCrossoverStrategy` de [app.js](file:///c:/Users/gira/Desktop/backtesting/app.js):
- Utiliza la función interna `calculateEMA` o `calculateSMA`.
- Ejecuta compras asignando el 100% de la liquidez menos las comisiones y ventas liquidando las unidades completas.

---

## 📊 Historial de Backtesting

### Registro 1: BTC/USDT (Temporalidad 4 Horas)
- **Fecha de prueba**: 2026-07-13
- **Periodo de Velas**: 500 velas (~83 días)
- **Parámetros**: Rápida = 9 (EMA), Lenta = 21 (EMA), Comisión = 0.1%
- **Resultados**:
  - **Retorno Neto**: `-11.82%` (-$1,181.83 netos)
  - **Operaciones completadas**: 14
  - **Tasa de Acierto (Win Rate)**: `21.4%`
  - **Drawdown Máximo**: `-17.12%`
  - **Profit Factor**: `0.32`
- **Observaciones**: Mal rendimiento en mercados con rangos laterales prolongados. Sufre de múltiples señales falsas y "whipsaws" (amagos de cruce).
