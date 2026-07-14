---
title: "VWAP + EMA Cruce Triple — Filtro de Confirmación por Cuerpo de Vela (no mechas)"
type: analysis
tags: [ema-cross, vwap, btc, candle-body, confirmation-filter, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Probar si exigir que la vela que completa la alineación EMA+VWAP de la [Estrategia 2](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) cierre con **cuerpo real direccional** (no mecha/doji) mejora el acierto y el retorno, tanto para el par validado 21/30 como para los pares más cortos descartados en [ema_periodos_cortos_vs_2130.md](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md).

## Método

Filtro nuevo (`bodyMinRatio`), aplicado sólo a la vela que dispara la señal:
- `bodyRatio = |close - open| / (high - low)`
- Se exige `bodyRatio >= bodyMinRatio` **y** que el cuerpo esté en la dirección de la operación (`close > open` para BUY, `close < open` para SHORT).
- `bodyMinRatio = 0` reproduce exactamente el comportamiento actual (sin filtro).

Se barrieron 6 combinaciones EMA fast/slow × 4 umbrales de cuerpo (0, 0.3, 0.5, 0.7) sobre ~1000 velas 4h BTC/USDT en vivo de Binance, con `vwapPeriod=80`, `atrMult=2.0`, `rrRatio=1.0` constantes. Validación separada in-sample (70%) / out-of-sample (30%), igual que el análisis anterior. **No se modificó `js/strategy-emacross.js`** — este es un experimento aislado, pendiente de validación antes de tocar código de producción, según la regla de `AGENTS.md`.

## Resultados clave (ventana completa, combinado IS+OOS)

| fast/slow | body≥ | Trades | Win Rate | Retorno | Max DD | PF |
|---|---|---|---|---|---|---|
| 21/30 (baseline) | 0   | 17 | 76.5% | **+31.40%** | 4.37% | 3.49 |
| 21/30 | 0.3 | 6  | 83.3% | +9.42%  | 4.37% | 4.18 |
| 21/30 | 0.5 | 5  | 80.0% | +6.84%  | 4.37% | 3.31 |
| 7/21  | 0   | 28 | 64.3% | +15.91% | 12.73% | 1.51 |
| 7/21  | 0.3 | 18 | 77.8% | +22.68% | 8.96%  | 2.75 |
| 7/21  | 0.5 | 16 | 81.3% | +24.63% | 8.96%  | 3.25 |
| 14/21 | 0   | 25 | 68.0% | +22.44% | 7.15%  | 1.88 |
| 14/21 | 0.3 | 17 | 76.5% | +20.05% | 7.16%  | 2.49 |
| 14/21 | 0.7 | 8  | 87.5% | +14.92% | 3.33%  | 5.35 |

(Tabla completa de 24 filas — 6 combos × 4 umbrales — y desglose in-sample/out-of-sample en el log de ejecución del script `backtest_ema_body_filter.js`.)

## Interpretación

1. **El filtro de cuerpo SÍ mejora los pares cortos previamente descartados.** 7/21 pasa de 64.3%→81.3% win rate y de +15.91%→+24.63% retorno con `body≥0.5`, con PF subiendo de 1.51→3.25 y drawdown bajando de 12.73%→8.96%. 14/21 mejora de forma similar. Esto confirma la intuición: parte del ruido de los pares cortos venía de cruces disparados por mechas/dojis sin convicción direccional real, y el filtro los elimina.

2. **El filtro NO mejora a 21/30 — lo empeora en retorno.** Con `body≥0.3` el win rate y PF suben levemente (76.5%→83.3%, PF 3.49→4.18), pero el retorno cae de +31.40% a +9.42% porque el número de trades se reduce de 17 a 6: se filtran operaciones que también eran ganadoras, y menos operaciones implica menos capitalización compuesta. El drawdown no cambia (4.37% en ambos) porque las pérdidas grandes ya no dominaban ese par.

3. **Ningún par con filtro supera al 21/30 sin filtro en retorno combinado.** El mejor candidato filtrado (7/21 @ body≥0.5, +24.63%) queda por debajo del baseline 21/30 (+31.40%).

4. **Advertencia de tamaño de muestra**: a partir de `body≥0.5` los conteos de trades caen a un rango de 2–9 en ventana completa y 2–5 en cada sub-ventana (IS/OOS por separado) — insuficiente para conclusiones estadísticamente robustas. Varias celdas de la tabla out-of-sample muestran Win Rate 100% o Profit Factor infinito con solo 2–3 operaciones, un patrón clásico de sobreajuste por muestra pequeña, no de una ventaja real. Estos resultados no deben leerse como "el filtro es mejor en OOS" sin más evidencia.

## Conclusión

El filtro de cuerpo de vela es una mejora real para los pares EMA cortos (7/21, 14/21) — los acerca considerablemente al rendimiento de 21/30 sin llegar a superarlo — pero al aplicarse sobre el propio 21/30 reduce el retorno total al eliminar operaciones ganadoras junto con las de mecha. **No se recomienda adoptar el filtro de cuerpo sobre los parámetros validados actuales (21/30).** Si se quisiera operar con periodos más cortos por mayor frecuencia de señales, el filtro de cuerpo (`body≥0.5`) sería la forma correcta de hacerlo sin perder tanto acierto — pero seguiría rindiendo menos que el 21/30 actual con la muestra disponible.

## Referencias

- [Barrido de Periodos EMA (7/14 vs 21/30)](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md)
- [Estrategia VWAP + EMA Cruce (cruce_de_medias.md)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md)
- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) — vector de "vela de rechazo fuerte" ya validado para la Estrategia 1 (Wyckoff), consistente con este hallazgo
