---
title: "RSI Reversión a la Media"
type: strategy
tags: [mean-reversion, oscillator, rsi]
created: 2026-07-13
last_updated: 2026-07-13
---

# RSI Reversión a la Media (RSI Mean Reversion)

> Estado vigente revisado el 2026-11-03: la aplicación ahora usa RSI14 bajo 25 con VWAP1000 ascendente, y salida VWAP100 o RSI65 (opción alternativa RSI60). La nota 30/70 anterior describe la versión que existía al comenzar ese análisis. Véase la [evaluación de cinco años y dos operaciones mensuales](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_frecuencia_dos_operaciones_mes.md) para las reglas actuales, conteos mensuales y comparación de 972 variantes.

> Actualización 2026-11-03: las reglas de rebote descritas abajo no coinciden con la pestaña actual. `js/strategy-rsi.js` implementa `runRsiZoneStrategy`: compra al caer bajo 30 y vende al superar 70, sin stop. La referencia posterior a `app.js` es histórica; el cálculo vigente está en `js/indicators.js`. Véase el [análisis reproducible de diez variantes long BTC/USDT 4h](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_rsi_long_4h.md), que no encuentra una ganadora robusta.

Estrategia cuantitativa basada en osciladores. Consiste en monitorear los niveles de velocidad y cambio en los movimientos de precios usando el Índice de Fuerza Relativa (RSI).

---

## 🛠️ Fundamento Matemático

1. **Cálculo de RSI**:
   $$RS = \frac{AvgGain_n}{AvgLoss_n}$$
   $$RSI = 100 - \frac{100}{1 + RS}$$
   Donde las pérdidas y ganancias promedio iniciales son medias móviles simples de $n$ periodos, y los valores siguientes se suavizan con la media móvil de Wilder:
   $$AvgGain_t = \frac{AvgGain_{t-1} \cdot (n - 1) + Gain_t}{n}$$

### Reglas de Entrada y Salida:
- **Señal de Compra (Oversold)**: El RSI cae en zona de sobreventa (por debajo de un umbral, p. ej. 30) y luego cruza hacia arriba ese nivel:
  $$RSI_{t-1} \le BuyLevel \quad \text{y} \quad RSI_t > BuyLevel$$
- **Señal de Venta (Overbought)**: El RSI sube en zona de sobrecompra (por encima de un umbral, p. ej. 70) y luego cruza hacia abajo ese nivel:
  $$RSI_{t-1} \ge SellLevel \quad \text{y} \quad RSI_t < SellLevel$$

---

## 💻 Implementación en Código

Ubicada en la función `runRsiStrategy` de [app.js](file:///c:/Users/gira/Desktop/backtesting/app.js):
- Utiliza la función interna `calculateRSI` aplicando el método de suavizado Wilder.
- Genera señales de compra/venta al cruzar los umbrales de entrada y salida configurados.

---

## 📊 Historial de Backtesting

### Registro 1: BTC/USDT (Temporalidad 4 Horas)
- **Fecha de prueba**: 2026-07-13
- **Periodo de Velas**: 500 velas (~83 días)
- **Parámetros**: Periodo = 14, Nivel de Compra = 30, Nivel de Venta = 70, Comisión = 0.1%
- **Resultados**:
  - **Retorno Neto**: `-9.17%` (-$917.47 netos)
  - **Operaciones completadas**: 2
  - **Tasa de Acierto (Win Rate)**: `50.0%`
  - **Drawdown Máximo**: `-22.32%`
  - **Profit Factor**: `0.23`
- **Observaciones**: Muestra muy pocas operaciones en esta temporalidad debido a la exigencia del cruce de rebote. La efectividad mejora en mercados de rango consolidado, pero es propensa a pérdidas durante fuertes tendencias de un solo sentido (mercado tendencial alcista o bajista sin pausas).
