---
title: "VWAP + EMA Cruce Triple — Confirmación Multi-Timeframe con EMA Diaria"
type: analysis
tags: [ema-cross, vwap, btc, mtf, multi-timeframe, ema-diaria, overfitting]
created: 2026-07-13
last_updated: 2026-07-13
---

## Objetivo

Validar la mejora Multi-Timeframe del [roadmap](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) (sección 4; #8 en la numeración de `AGENTS.md`): exigir que la tendencia diaria (precio 4h vs EMA diaria) esté alineada con la dirección del trade antes de permitir la entrada en la Estrategia 2.

## Método

- Datos reales de Binance: 3000 velas 4h (mar 2025 → jul 2026) + 2000 velas diarias (ene 2021 → jul 2026, warm-up sobrado incluso para EMA200).
- **Sin lookahead**: cada vela 4h se compara contra la última vela diaria *ya cerrada* en su momento (`closeTime_diaria <= closeTime_4h`), nunca contra la diaria en curso.
- Gate: LONG solo si `close_4h > EMA_diaria`; SHORT solo si `close_4h < EMA_diaria`.
- Barrido del periodo de la EMA diaria: **20, 50, 100, 200**, cada uno en dos variantes:
  - **hard**: la señal bloqueada desaparece por completo (tampoco cierra la posición contraria).
  - **soft**: la señal bloqueada no abre posición nueva pero sí cierra la contraria (conserva el mecanismo de reversión del baseline).
- Ventanas LIVE (últimas 1000 velas 4h) / HIST (~1800 previas), baseline 21/30/vwap80/atr2/rr1. Sin modificar código de producción.

## Resultados

| Gate | LIVE: WR / Ret / PF | HIST: WR / Ret / PF |
|---|---|---|
| **Sin gate (baseline)** | 75.0% / **+25.35%** / 3.11 | 61.3% / **+8.47%** / 1.27 |
| EMA20d | 84.6% / +28.91% / 5.63 | 53.6% / **−2.39%** / 0.93 |
| EMA50d (propuesta del roadmap) | 75.0% / +12.02% / 3.09 | 55.6% / **−2.38%** / 0.88 |
| EMA100d | 75.0% / +12.02% / 3.09 | 52.9% / **−3.46%** / 0.83 |
| EMA200d | 75.0% / +12.32% / 3.13 | 56.3% / +0.45% / 1.03 |

(Las variantes soft mejoran HIST en ~1.3 puntos sobre hard en todos los casos — insuficiente para cambiar ninguna conclusión.)

## Interpretación

1. **La propuesta concreta del roadmap (EMA50 diaria) empeora ambas ventanas**: recorta el retorno LIVE a la mitad (+25.35% → +12.02%) sin subir el acierto, y convierte el HIST de +8.47% en −2.38%. Rechazo directo.
2. **EMA20d es otro espejismo de régimen** — el cuarto detectado en esta serie de análisis: en LIVE parece la mejora perfecta (84.6% WR, PF 5.63, retorno superior al baseline), pero en HIST pasa a retorno negativo (PF 0.93). Mismo patrón que los filtros de volumen y Bollinger.
3. **Por qué falla la premisa**: la EMA diaria retrasa tanto que, cuando la tendencia diaria "confirma", el movimiento que el cruce 4h capturaba ya está gastado. Además, en el mercado lateral-bajista de 2025 el gate bloquea sistemáticamente los trades contra-tendencia que eran ganadores (la estrategia gana en ambas direcciones — los SHORT aportaron retorno positivo también en HIST). El mecanismo de reversión del baseline ya gestiona la dirección mejor que un filtro macro retrasado.
4. Todos los gates dejan el acierto HIST *peor* que el baseline (52.9–56.3% vs 61.3%) — el filtro elimina proporcionalmente más ganadores que perdedores fuera del régimen actual.

## Conclusión

**Mejora MTF evaluada y rechazada para la Estrategia 2.** Ninguna variante (4 periodos × 2 modos) supera al baseline en ambas ventanas; la mayoría empeora las dos. Con esto, **todos los vectores del roadmap aplicables a la Estrategia 2 quedan evaluados y rechazados** (volumen, Bollinger, trailing, percentil ATR condicional, y ahora MTF), reforzando la conclusión acumulada: la configuración actual 21/30/vwap80/atr2.0/rr1.0 en 4h es un óptimo local genuino y robusto, y las mejoras restantes del roadmap solo tienen sentido para la Estrategia 1 (Wyckoff), cuya lógica de entrada es distinta.

## Referencias

- [Análisis Profundo de Mejora (3000 velas)](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md)
- [Temporalidades 1h y Diario](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_temporalidades_1h_1d_ema.md) — ya había demostrado que el diario define regímenes pero no sirve para operar
- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md) — sección 4 (propuesta original MTF)
