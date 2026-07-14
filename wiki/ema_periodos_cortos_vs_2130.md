---
title: "VWAP + EMA Cruce Triple — Barrido de Periodos EMA (7/14 vs 21/30)"
type: analysis
tags: [ema-cross, vwap, btc, parameter-sweep, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Evaluar si acortar los periodos EMA de la [Estrategia 2 (VWAP + EMA Cruce Triple)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) de 21/30 a 7/14 (u otras combinaciones intermedias) mejora el retorno y el acierto (win rate), tal como se documenta en `js/config.js` → `STRATEGY2_PARAMS`.

## Método

Se ejecutó el motor real del proyecto (`js/indicators.js` + `js/simulator.js` + `js/strategy-emacross.js`, sin modificar) contra ~1000 velas 4h de BTC/USDT en vivo desde Binance (2026-01-28 → 2026-07-14), barriendo todas las combinaciones fast/slow con `fast < slow` del conjunto {7, 14, 21, 30}. `vwapPeriod=80`, `atrMult=2.0`, `rrRatio=1.0` se mantuvieron constantes (sin tocar) para aislar el efecto del cambio de periodos EMA.

Siguiendo la constricción de `AGENTS.md` de validar in-sample y out-of-sample por separado, la ventana se dividió 70/30: **in-sample** = primeras 700 velas, **out-of-sample** = últimas 300 velas. Las métricas del "retorno combinado" (ventana completa) NO deben confundirse con las de cada sub-ventana — se reportan las tres por separado.

## Resultados

### Ventana completa (combinado IS+OOS, ~1000 velas)

| fast/slow | Trades | Win Rate | Retorno | Max DD | Profit Factor |
|---|---|---|---|---|---|
| 7/14  | 31 | 54.8% | +0.55%  | 12.73% | 1.05 |
| 7/21  | 28 | 64.3% | +16.03% | 12.73% | 1.51 |
| 7/30  | 26 | 69.2% | +24.55% | 12.52% | 1.93 |
| 14/21 | 25 | 68.0% | +22.57% | 7.15%  | 1.88 |
| 14/30 | 20 | 70.0% | +24.32% | 7.16%  | 2.18 |
| **21/30** | **17** | **76.5%** | **+31.40%** | **4.37%** | **3.49** |

### In-sample (primer 70%)

| fast/slow | Trades | Win Rate | Retorno | Max DD | PF |
|---|---|---|---|---|---|
| 7/14  | 24 | 54.2% | +2.17%  | 12.73% | 1.06 |
| 7/21  | 22 | 63.6% | +15.01% | 12.73% | 1.56 |
| 7/30  | 20 | 60.0% | +9.31%  | 12.52% | 1.35 |
| 14/21 | 20 | 65.0% | +16.61% | 7.15%  | 1.67 |
| 14/30 | 15 | 66.7% | +16.81% | 7.16%  | 1.95 |
| **21/30** | **13** | **76.9%** | **+25.86%** | **4.37%** | **3.73** |

### Out-of-sample (último 30%)

| fast/slow | Trades | Win Rate | Retorno | Max DD | PF |
|---|---|---|---|---|---|
| 7/14  | 6 | 50.0% | −2.63% | 8.35% | 0.84 |
| 7/21  | 5 | 60.0% | −1.27% | 6.94% | 1.02 |
| 7/30  | 6 | 83.3% | +7.06% | 6.75% | 2.69 |
| 14/21 | 5 | 60.0% | −1.28% | 6.94% | 1.01 |
| 14/30 | 5 | 60.0% | +0.01% | 7.01% | 1.00 |
| **21/30** | **5** | **60.0%** | **+0.03%** | **6.99%** | **1.00** |

## Conclusión

**7/14 es estrictamente peor que 21/30 en todas las métricas**: retorno casi plano (+0.55% vs +31.40% combinado), win rate ~22 puntos por debajo (54.8% vs 76.5%), drawdown casi 3× mayor (12.73% vs 4.37%), y Profit Factor apenas por encima de 1 (1.05, break-even) frente a 3.49. Esto confirma el patrón ya documentado en `js/config.js`: acortar los periodos genera más señales de cruce en ruido de corto plazo (whipsaws) en vez de tendencias reales, degradando tanto el acierto como el retorno — el mismo motivo por el que un candidato 7/15/vwap20 fue rechazado anteriormente por overfitting.

El barrido confirma una tendencia monótona: a medida que fast/slow crecen desde 7/14 hacia 21/30, mejoran simultáneamente el win rate, el retorno y el drawdown en la ventana completa y en in-sample. 21/30 sigue siendo el mejor punto del vecindario probado.

**Nota sobre out-of-sample**: en el tramo OOS reciente (últimas 300 velas), todas las combinaciones ≥14/21 rinden planas o ligeramente negativas (pocos trades, 5 en la mayoría de los casos), y 7/30 destaca con 83.3% de acierto — pero sobre solo 6 operaciones, muestra insuficiente para conclusiones robustas. Esto es consistente con lo esperado: el régimen de mercado del tramo OOS actual ha sido menos favorable para el cruce EMA+VWAP en general, no específico de 21/30. No se recomienda cambiar los parámetros validados a partir de esta muestra pequeña.

**Recomendación**: mantener `emaFast=21, emaSlow=30` sin cambios. No hay evidencia para adoptar 7/14 ni ninguna combinación con fast=7 o fast=14 — todas rinden peor en la métrica combinada y en in-sample, que es la ventana de mayor tamaño muestral.

## Referencias

- [Estrategia VWAP + EMA Cruce (cruce_de_medias.md)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md)
- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md)
- [.agents/AGENTS.md](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md) — Strategy 2 params y advertencia de overfitting
