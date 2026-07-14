---
title: "VWAP + EMA Cruce Triple — Análisis Profundo de Mejora (3000 velas históricas)"
type: analysis
tags: [ema-cross, vwap, btc, parameter-sweep, regime, trailing-stop, atr-filter, bollinger, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Búsqueda sistemática de mejoras para los 5 indicadores del panel de la [Estrategia 2](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) (baseline 21/30: +31.40% retorno, 76.5% acierto, 4.37% DD, PF 3.49 en la ventana de la app), probando todos los ejes de mejora pendientes del roadmap aplicables y varias propuestas nuevas, contra una historia ampliada.

## Método

Se amplió la historia a **3000 velas 4h de BTC/USDT** (2025-03-01 → 2026-07-14) paginando la API de Binance. Dos ventanas de evaluación:
- **LIVE**: últimas 1000 velas (la misma ventana de la app y de todos los análisis anteriores), con subdivisión IS 70% / OOS 30%.
- **HIST**: las ~1800 velas anteriores (mar 2025 → ene 2026) — *out-of-sample verdadero del pasado*, nunca usado para elegir ningún parámetro de este proyecto.

Ejes probados (uno a la vez, luego combos de ganadores): rejilla `atrMult` {1.5–3.0} × `rrRatio` {1.0–2.0}; barrido `vwapPeriod` {50–120}; gestión de salida (breakeven tras 1R, trailing stop ATR, trailing sin TP — mejora #6 del roadmap); filtro de volumen ≥ k×SMA20 (variante de mejora #4); filtro de régimen por percentil de ATR (mejora #3); filtro de squeeze de Bandas de Bollinger (mejora #7); y descomposición LONG-only / SHORT-only. Todo sin lookahead y sin modificar código de producción.

> Nota metodológica: al computar los indicadores sobre la serie completa de 3000 velas, las EMA/VWAP entran "calientes" a la ventana LIVE, por lo que el baseline aquí (+25.35%, 75.0% WR, 16 trades) difiere levemente del de la app (+31.40%, 17 trades), que arranca los indicadores en frío. Las comparaciones dentro de este análisis son consistentes entre sí.

## Hallazgo principal: dependencia de régimen

**El baseline validado rinde mucho peor en la historia previa.** En HIST (mar 2025 → ene 2026): 61.3% acierto, +8.47% retorno, 9.87% DD, PF 1.27 — frente a 75-76% / +25-31% / 4.37% / 3.1-3.5 en LIVE. La estrategia es genuinamente rentable en ambas ventanas, pero las métricas estelares del panel dependen en buena parte del régimen de mercado de los últimos ~5 meses, no solo de los parámetros. **Cualquier "mejora" medida solo en la ventana LIVE es sospechosa de ajuste al régimen.**

Este hallazgo quedó demostrado con dos trampas detectadas en este mismo análisis:

| Filtro | LIVE | HIST | Veredicto |
|---|---|---|---|
| Bollinger bbw≥0.4 | 85.7% WR, PF 6.76, DD 2.91% | **+0.25% retorno, PF 1.01** | Espejismo de régimen — rechazado |
| Volumen ≥1.5×SMA20 | 80% WR, PF 3.94 | **−9.35% retorno, PF 0.32** | Catastrófico fuera de la ventana — rechazado |

Sin la ventana HIST, ambos filtros se habrían adoptado como "mejoras" claras.

## Resultados por eje

1. **Rejilla atrMult × rrRatio**: `2.0/1.0` (actual) es el óptimo en LIVE y ninguna celda lo domina en ambas ventanas. Subir `rrRatio` mejora algo el retorno HIST (2/2 → +24.55%) pero hunde el acierto a ~48% y duplica el drawdown en ambas ventanas — contrario al objetivo de mejorar el panel.
2. **vwapPeriod**: 80 es óptimo en LIVE, pero el vecindario es menos estable de lo documentado cuando se mide en HIST (90 y 100 dan retorno *negativo* en HIST). Mantener 80; no hay mejora disponible en este eje.
3. **Gestión de salida (breakeven / trailing / trailing sin TP)**: efecto **nulo** en LIVE — con TP a 1:1, el target se alcanza antes de que el trailing llegue a actuar — y levemente negativo en HIST. La mejora #6 del roadmap no aplica a esta estrategia mientras `rrRatio=1.0`.
4. **Filtro de volumen**: rechazado (ver tabla de trampas).
5. **Filtro percentil de ATR (mejora #3)**: el único cambio que mejora la ventana débil. Con `ATR pctile ≤ 0.5`: HIST mejora a 64.7% WR, PF 1.68, DD 6.61% (desde 61.3% / 1.27 / 9.87%), a costa de recortar el retorno LIVE de +25.35% a +16.39%. Es una mejora de *robustez*, no de retorno.
6. **Bollinger squeeze**: rechazado (ver tabla de trampas).
7. **LONG-only / SHORT-only**: ambos lados contribuyen simétricamente en LIVE (75% WR cada uno); en HIST los cortos son más débiles (+1.90%) pero no negativos. No hay ventaja en operar un solo lado.
8. **Combos** (atrP0.6 + rr1.5, atrP0.6 + atr2.5/rr1.5, LONG-only + atrP0.6): ninguno supera al baseline ni al filtro ATR solo; apilar filtros degrada.

## Adenda: barrido fino de VWAP < 80 (pasos de 5)

A petición del usuario se completó el barrido de `vwapPeriod` de 20 a 80 en pasos de 5, cruzado con los tres pares EMA supervivientes (21/30, 14/30, 14/21), en LIVE y HIST:

- **VWAP 20–50 es desastroso en todas las combinaciones**: retornos negativos de hasta −30% en LIVE y drawdowns de 20–35%. Un VWAP tan corto pierde su función de "gate" de tendencia y sigue al precio de cerca, generando alineaciones falsas constantes.
- **Existen dos picos secundarios en 55 y 65** (con 21/30): vwap55 da +22.44% LIVE / +15.21% HIST y vwap65 da +18.91% / +14.63% — de hecho, ambos rinden *mejor que vwap80 en HIST* (+8.47%). Pero son **picos aislados y puntiagudos**: sus vecinos inmediatos colapsan (vwap50 → +6.46%, vwap60 → +4.92% en LIVE), la firma clásica de un punto frágil/sobreajustado. El vecindario de 80 es mucho más suave (75 → +13.56%, 90 → +21.75%).
- Curiosidad consistente: vwap55 es exactamente el valor validado de forma independiente para la Estrategia 3 (ETH/USDT) — el pico secundario parece real pero no lo bastante estable en BTC para justificar el cambio.

**Conclusión de la adenda**: el espacio VWAP < 80 queda completamente explorado; no hay mejora robusta disponible por debajo de 80. Se mantiene `vwapPeriod=80`.

## Conclusión

**No existe, en el espacio explorado, ninguna combinación que mejore simultáneamente el retorno y el acierto del baseline 21/30 actual.** El baseline es el máximo de retorno en la ventana LIVE, y las alternativas que suben el acierto (filtro ATR, S/R-cap del [análisis anterior](file:///c:/Users/gira/Desktop/backtesting/wiki/soporte_resistencia_take_profit_ema.md), cuerpo de vela del [otro análisis](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md)) lo hacen recortando el retorno — el patrón es consistente en los tres estudios.

Recomendaciones:
- **Mantener los parámetros actuales sin cambios.**
- El único candidato defendible es el **filtro de percentil de ATR ≤ 0.5-0.6** (mejora #3 del roadmap): no mejora el panel en el régimen actual, pero reduce el drawdown y sube PF/acierto en regímenes desfavorables como el de 2025. Adoptarlo es una decisión de perfil de riesgo (robustez vs. retorno), y requeriría validación adicional en más historia antes de tocar `config.js`.
- **Actualizar las expectativas**: el retorno esperado de la estrategia a través de regímenes completos es más cercano a +8-25% por ~1000 velas que al +31.4% del panel actual. Descontar esto en cualquier decisión de capital.
- Marcar las mejoras #4 (volumen, en su variante para esta estrategia), #6 (trailing) y #7 (Bollinger) del [roadmap](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) como **evaluadas y rechazadas para la Estrategia 2** (siguen pendientes para la Estrategia 1 Wyckoff, donde su lógica difiere).

## Referencias

- [Barrido de Periodos EMA (7/14 vs 21/30)](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md)
- [Filtro de Cuerpo de Vela](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md)
- [Take-Profit por Soporte/Resistencia](file:///c:/Users/gira/Desktop/backtesting/wiki/soporte_resistencia_take_profit_ema.md)
- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md)
