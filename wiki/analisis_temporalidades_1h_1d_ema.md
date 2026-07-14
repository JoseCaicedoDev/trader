---
title: "VWAP + EMA Cruce Triple — Análisis en Temporalidades 1h y Diario"
type: analysis
tags: [ema-cross, vwap, btc, timeframe, 1h, 1d, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Replicar el [análisis profundo de la Estrategia 2](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md) (validada en 4h) sobre las temporalidades **1h** y **1d**, para comprobar si la lógica de alineación triple EMA+VWAP mantiene su ventaja fuera de 4h y si existen parámetros mejores específicos de cada temporalidad.

## Método

Mismo motor y misma metodología: por cada temporalidad se barrió el espacio de pares EMA (8 combinaciones de {7,14,21,30,50}), `vwapPeriod` (40–150) y la rejilla `atrMult × rrRatio` (12 celdas), evaluando en dos ventanas: **LIVE** (últimas 1000 velas) e **HIST** (todo lo anterior tras warm-up).

- **1h**: 6000 velas (nov 2025 → jul 2026; HIST ≈ 4800 velas).
- **1d**: 3000 velas (**abr 2018 → jul 2026**, ~8 años que cubren dos bear markets y tres bull markets; HIST ≈ 1800 velas).

## Resultados 1h — la estrategia NO funciona

Baseline 21/30/vwap80: **LIVE −1.64% (PF 0.87), HIST +0.27% (PF 1.00)** — break-even antes de considerar nada más. El barrido completo no encontró ninguna configuración rentable en ambas ventanas:

| Config | LIVE | HIST | Diagnóstico |
|---|---|---|---|
| 21/30 vwap80 (baseline 4h) | −1.64%, PF 0.87 | +0.27%, PF 1.00 | Break-even |
| 30/50 | −6.20%, PF 0.47 | **+38.40%, PF 1.78** | Espejismo: excelente HIST, pierde LIVE |
| 21/50 | +1.83%, PF 1.18 | +12.25%, PF 1.20 | Lo menos malo; retorno marginal para 87-103 trades |
| vwap150 | +4.21%, PF 1.58 | −19.94%, PF 0.67 | Espejismo inverso |
| atr2.5-3/rr1.5 | −5 a −9%, PF ~0.6 | +33-37%, PF ~1.5 | Inestable entre ventanas |

**Por qué falla**: en 1h el movimiento medio por vela es mucho menor, así que (a) el ruido genera muchas más alineaciones falsas (89-161 trades vs 16-31 en 4h), y (b) la comisión del 0.1% por lado pesa proporcionalmente mucho más contra objetivos ATR pequeños. El coste friccional consume la ventaja.

## Resultados 1d — inestable y con drawdowns inaceptables

Baseline 21/30/vwap80: **LIVE −27.49% (PF 0.54, DD 38.9%)** — los parámetros de 4h *no transfieren* al diario. El barrido muestra un patrón sistemático de inestabilidad:

| Config | LIVE | HIST | Diagnóstico |
|---|---|---|---|
| 21/30 vwap80 (baseline 4h) | **−27.49%**, DD 38.9% | +22.93%, PF 1.16 | No transfiere |
| 7/14 | −24.31%, DD 37.8% | **+148.39%**, DD 52.6% | Espejismo extremo |
| 7/21 | +19.28%, PF 1.22, DD 27.3% | +92.43%, PF 1.25, DD 43.2% | Único par positivo en ambas — pero DD 27-43% |
| 21/30 + vwap55 | +20.89%, DD 23.8% | +14.57%, DD 40.4% | Positivo en ambas, DD enorme |
| atr3/rr1 | +21.87%, PF 1.48 | −15.09%, PF 0.93 | Espejismo inverso |

En diario sí existen configuraciones positivas en ambas ventanas (7/21, o 21/30 con vwap55), pero **todas cargan drawdowns del 24–52%** — de 5 a 12 veces el 4.37% de la estrategia en 4h — con profit factors de apenas 1.1–1.3. En términos ajustados a riesgo, ninguna se acerca al 4h. La causa estructural: con ~15–30 señales en 1000 velas diarias (~2.7 años), cada racha adversa de 3-4 stops consecutivos con sizing al 100% del capital produce caídas masivas, y el stop ATR diario es tan ancho que cada pérdida individual es grande.

## Conclusión

**La temporalidad 4h no es un parámetro más — es parte del núcleo de la ventaja de la estrategia.**

- **1h: descartada.** Ruido + fricción de comisiones = break-even estructural. Ninguna combinación rentable estable.
- **1d: descartada.** Existen configuraciones marginalmente rentables pero con drawdowns del 24–52%, inaceptables frente al perfil del 4h. Los parámetros 21/30/vwap80 directamente pierden −27% en la ventana reciente.
- Los parámetros óptimos NO transfieren entre temporalidades (el mejor par en 1d sería 7/21 — justamente uno de los rechazados en 4h), lo que refuerza que cada temporalidad exigiría su propia validación completa... y aun así ninguna alcanza al 4h.

**Recomendación**: mantener la Estrategia 2 exclusivamente en 4h. No desarrollar variantes 1h/1d. El uso legítimo del diario sería como *filtro de confirmación multi-timeframe* para la señal 4h (mejora #8 del [roadmap](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md)), no como temporalidad de operación.

## Referencias

- [Análisis Profundo de Mejora (4h, 3000 velas)](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md)
- [Barrido de Periodos EMA (7/14 vs 21/30)](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md)
- [Estrategia VWAP + EMA Cruce](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md)
