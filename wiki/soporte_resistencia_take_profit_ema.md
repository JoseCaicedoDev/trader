---
title: "VWAP + EMA Cruce Triple — Take-Profit basado en Soporte/Resistencia"
type: analysis
tags: [ema-cross, vwap, btc, support-resistance, take-profit, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Evaluar si usar niveles mayores de Soporte/Resistencia (pivotes swing confirmados, técnica ya validada en la [Estrategia 1 Wyckoff](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md)) como target de Take-Profit mejora la [Estrategia 2 (VWAP + EMA Cruce)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md), que actualmente usa un target fijo `stopDist × rrRatio (1.0)`.

## Método

Se reutilizó `detectSwingLevels(data, srBars)` de `js/indicators.js` (idéntica función usada por la Estrategia 1), con el mismo mecanismo de dos punteros para garantizar que solo se usan pivotes ya confirmados (`confirmedAt <= i`, sin lookahead). Se probaron dos modos de combinación con el target fijo actual:

- **`cap`**: usa el S/R más cercano como target *solo si* está más cerca que el target fijo (toma ganancias antes, más conservador — replica exactamente la lógica de TP de la Estrategia 1 Wyckoff).
- **`extend`**: usa el S/R más cercano *solo si* está más lejos que el target fijo (deja correr la ganancia hasta la resistencia/soporte real).

Se barrió sobre 3 combinaciones EMA (7/21, 14/21, 21/30) × 3 modos (off/cap/extend), `srBars=10`, más una prueba de sensibilidad de `srBars` (5 a 20) sobre el par validado 21/30. Mismos datos en vivo (~1000 velas 4h BTC/USDT) y misma validación IS(70%)/OOS(30%) separada que los análisis anteriores. **No se modificó `js/strategy-emacross.js`** — experimento aislado.

## Resultados (ventana completa, combinado IS+OOS)

| fast/slow | Modo | Trades | Win Rate | Retorno | Max DD | PF |
|---|---|---|---|---|---|---|
| 21/30 | off (baseline) | 17 | 76.5% | **+31.40%** | 4.37% | 3.49 |
| 21/30 | cap    | 17 | 82.4% | +14.00% | 3.57% | 2.73 |
| 21/30 | extend | 14 | 64.3% | +8.97%  | 10.47% | 1.66 |
| 14/21 | off | 25 | 68.0% | +22.58% | 7.15% | 1.88 |
| 14/21 | cap | 27 | 66.7% | +1.13%  | 13.97% | 1.05 |
| 7/21  | off | 28 | 64.3% | +16.04% | 12.73% | 1.51 |
| 7/21  | cap | 30 | 70.0% | +8.61%  | 10.69% | 1.34 |

### Sensibilidad de `srBars` (21/30, modo cap, ventana completa)

| srBars | Win Rate | Retorno | Max DD | PF |
|---|---|---|---|---|
| 5  | 83.3% | +2.86%  | 3.71% | 1.39 |
| 8  | 82.4% | +13.53% | 3.71% | 2.68 |
| 10 | 82.4% | +14.00% | 3.57% | 2.73 |
| 12 | 82.4% | +16.00% | 3.56% | 2.97 |
| 15 | 76.5% | +14.86% | 4.75% | 2.31 |
| 20 | 76.5% | +14.86% | 4.75% | 2.31 |

## Interpretación

1. **Modo `cap` (TP conservador con S/R) sube el acierto pero recorta el retorno a menos de la mitad.** En 21/30, el win rate mejora 76.5%→82.4% (consistente 76-84% en IS/full/srBars 8-20), y el drawdown baja levemente (4.37%→3.57%), pero el retorno cae de +31.40% a +14.00% porque el sistema toma ganancias en la resistencia más cercana en vez de dejar correr la operación hasta el target de 1:1 R:R — varias operaciones que habrían llegado al target fijo se cierran antes con menor ganancia. Es un trade-off clásico *más acierto, menos retorno por operación*, no una mejora neta.

2. **Modo `extend` (dejar correr hasta S/R lejano) es peor en todo.** Win rate, retorno y drawdown empeoran simultáneamente en las tres combinaciones probadas (21/30: 76.5%→64.3% WR, +31.40%→+8.97% retorno, 4.37%→10.47% DD). Extender el target más allá del 1:1 validado expone la operación a que el precio revierta antes de alcanzar la resistencia real, perdiendo ganancia flotante o incluso terminando en stop.

3. **`srBars` es razonablemente estable en el rango 8–12 (retorno 13.5%–16.0%, WR ~82%)** pero cae en los extremos: `srBars=5` genera pivotes demasiado frecuentes/ruidosos (retorno colapsa a +2.86%), y `srBars≥15` diluye el efecto (vuelve casi al comportamiento del target fijo). Ningún valor de `srBars` en modo `cap` recupera el retorno del baseline sin filtro.

4. **Los pares cortos (7/21, 14/21) no se benefician de forma consistente** — 14/21 con `cap` colapsa a +1.13% retorno con drawdown más que duplicado (7.15%→13.97%), peor que su propio baseline sin S/R.

5. **Out-of-sample sigue plano para todos los modos** (muestra de 5-6 trades, insuficiente para conclusiones), igual que en los análisis anteriores — el régimen reciente de mercado no favorece esta estrategia en general, independientemente del cambio evaluado.

## Conclusión

**Ninguno de los dos modos de S/R supera el retorno combinado del baseline 21/30 (+31.40%).** El modo `cap` es una alternativa legítima *si se prioriza el acierto y menor drawdown sobre el retorno total* (82.4% WR, DD 3.57%, pero retorno a menos de la mitad) — útil como perfil de riesgo más conservador, no como mejora estricta. El modo `extend` debe descartarse: empeora las tres métricas a la vez.

**No se recomienda modificar `js/strategy-emacross.js`** con esta lógica de S/R por ahora. El target fijo `stopDist × rrRatio (1.0)` sigue siendo superior en retorno total con los parámetros validados (21/30).

## Referencias

- [Barrido de Periodos EMA (7/14 vs 21/30)](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md)
- [Filtro de Confirmación por Cuerpo de Vela](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md)
- [Estrategia VWAP + EMA Cruce (cruce_de_medias.md)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md)
- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) — TP vía S/R ya validado y en producción para la Estrategia 1 Wyckoff; este análisis muestra que el mismo mecanismo no transfiere con ventaja neta a la Estrategia 2
