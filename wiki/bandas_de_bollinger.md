---
title: "Bandas de Bollinger"
type: strategy
tags: [volatility, mean-reversion, bollinger]
created: 2026-07-13
last_updated: 2026-07-13
---

# Bandas de Bollinger (Bollinger Bands Strategy)

Estrategia cuantitativa basada en la volatilidad y la reversión a la media. Monitorea desviaciones estándar del precio por encima y por debajo de una media móvil para identificar extremos estadísticos en la cotización.

---

## 🛠️ Fundamento Matemático

1. **Banda Media (Middle Band)**:
   $$MiddleBand_t = SMA(n)_t$$
2. **Desviación Estándar (StdDev)**:
   $$\sigma_t = \sqrt{ \frac{1}{n} \sum_{i=0}^{n-1} (Close_{t-i} - MiddleBand_t)^2 }$$
3. **Banda Superior (Upper Band)**:
   $$UpperBand_t = MiddleBand_t + k \cdot \sigma_t$$
4. **Banda Inferior (Lower Band)**:
   $$LowerBand_t = MiddleBand_t - k \cdot \sigma_t$$
   Donde $n$ es el periodo (típicamente 20) y $k$ es el multiplicador de desviación estándar (típicamente 2.0).

### Reglas de Entrada y Salida:
- **Señal de Compra (Lower Band Cross)**: El precio cruza por debajo de la banda inferior:
  $$Close_{t-1} \ge LowerBand_{t-1} \quad \text{y} \quad Close_t < LowerBand_t$$
- **Señal de Venta (Upper Band Cross)**: El precio cruza por encima de la banda superior:
  $$Close_{t-1} \le UpperBand_{t-1} \quad \text{y} \quad Close_t > UpperBand_t$$

---

## 💻 Implementación en Código

Ubicada en la función `runBollingerBandsStrategy` de [app.js](file:///c:/Users/gira/Desktop/backtesting/app.js):
- Utiliza la función interna `calculateBB`.
- Agrega líneas de soporte visual para la banda superior (roja discontinua), inferior (verde discontinua) y media (gris).

---

## 📊 Historial de Backtesting

### Registro 1: BTC/USDT (Temporalidad 4 Horas)
- **Fecha de prueba**: 2026-07-13
- **Periodo de Velas**: 500 velas (~83 días)
- **Parámetros**: Periodo = 20, Desviación Estándar = 2.5, Comisión = 0.1%
- **Resultados**:
  - **Retorno Neto**: `-17.08%`
  - **Operaciones completadas**: 1 (Compró a $78,827.21, vendió a $65,746.45)
  - **Drawdown Máximo**: `-25.94%`

### Registro 2: BTC/USDT (Temporalidad 4 Horas)
- **Fecha de prueba**: 2026-07-13
- **Periodo de Velas**: 500 velas (~83 días)
- **Parámetros**: Periodo = 20, Desviación Estándar = 1.5, Comisión = 0.1%
- **Resultados**:
  - **Retorno Neto**: `-8.91%`
  - **Operaciones completadas**: 9
  - **Tasa de Acierto (Win Rate)**: `33.3%`
  - **Drawdown Máximo**: `-22.69%`
  - **Profit Factor**: `0.60`
- **Observaciones**: Reducir el multiplicador de desviación estándar a 1.5 activa más operaciones, pero introduce mayor exposición a fluctuaciones. La estrategia se beneficia de rangos laterales muy definidos y tiene bajo rendimiento en mercados con rupturas e inicios de tendencias prolongadas.
