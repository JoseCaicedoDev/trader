---
title: "RSI long BTC/USDT 4h: comparación y validación temporal"
type: analysis
tags: [btc, rsi, long-only, backtesting, risk, statistics]
created: 2026-11-03
last_updated: 2026-11-03
---

# RSI long en BTC/USDT 4h

> Nota de vigencia: este informe corresponde a la versión 30/70 disponible al comenzar aquella revisión. El código cambió posteriormente a RSI25 con filtro VWAP y salida VWAP/RSI65. El [estudio posterior de cinco años y frecuencia mensual](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_frecuencia_dos_operaciones_mes.md) analiza la implementación vigente. Las cifras históricas de este documento no describen esa nueva versión.

## Conclusión

La regla 30/70 sin stop no es una estrategia suficientemente robusta para recomendar su uso con todo el capital. En esta comparación de diez variantes, ninguna ofrece evidencia convincente de una ventaja estable y resistente a costos. Esperar el rebote por encima de 30, añadir EMA200 o acortar el RSI no resolvió el problema. Esto limita la conclusión a estas diez variantes y este activo/temporalidad; no demuestra que toda estrategia RSI sea inviable.

La variante con mayor retorno en la evaluación final fue la entrada original con stop de 3 ATR. Su +7,2% vino acompañado de 31,2% de caída máxima y se convirtió en −6,5% con mayores costos. Es una candidata a investigación, no una ganadora validada. La elegida utilizando únicamente el período de desarrollo perdió en la evaluación final.

## Qué hace realmente la aplicación

`js/strategy-rsi.js`, función `runRsiZoneStrategy`:

- RSI de Wilder de 14 velas de cuatro horas.
- Compra al cruzar desde RSI ≥30 a RSI <30: entra durante la caída.
- Cierra el long al cruzar desde RSI ≤70 a RSI >70.
- Ignora nuevas compras mientras mantiene un long. No abre shorts.
- No utiliza stop, objetivo de precio ni límite de tiempo.
- El simulador invierte todo el capital disponible y cobra 0,1% por lado.
- La ejecución del backtest de producción ocurre al cierre de la misma vela que genera la señal.

La [página conceptual anterior](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md) describe otra regla: comprar al recuperar 30 y vender al perder 70. No corresponde al código actual. Los registros antiguos de `config.js` tampoco sustituyen esta prueba reproducible: usan fechas móviles y no incluyen el deslizamiento de este estudio.

Sobreventa no significa precio mínimo; sobrecompra no garantiza vender por encima de la entrada. Por ejemplo, después de una caída de 100 a 60, un rebote hasta 75 puede generar una salida RSI sin recuperar el precio inicial de compra.

## Datos y metodología

- Fuente: API pública spot de Binance, BTCUSDT, velas 4h; 19.352 registros desde enero de 2018.
- Corte: 2026-11-03 00:00 UTC, equivalente a 2026-11-02 19:00 en Bogotá. Última vela incluida: apertura 2026-11-02 20:00 UTC, cierre antes del corte. No se usa la vela en formación.
- 2018 proporciona calentamiento para RSI, ATR y EMA. Desarrollo: 2019-01-01 hasta 2025-01-01, excluido. Evaluación: 2025-01-01 hasta el corte, excluido.
- Se declararon diez hipótesis antes de ejecutar la comparación. La elección se hace en desarrollo por CAGR/drawdown máximo (Calmar), exigiendo al menos 30 operaciones. Los filtros EMA tienen 17 y 16 operaciones de desarrollo respectivamente y no son elegibles para selección por esta regla.
- El período final no se utilizó para seleccionar parámetros en este estudio. Es una separación retrospectiva: el proyecto ya contiene análisis históricos de esos años, por lo que no constituye evidencia prospectiva completamente desconocida.
- Señales al cierre de velas completas; ejecución en la apertura siguiente disponible. Comisión 0,10% y deslizamiento adverso 0,05% en cada lado. Sin apalancamiento, financiación, impuestos ni remuneración del efectivo.
- Stop fijo a 3 ATR(14), calculado con la vela de señal y anclado al precio ejecutado de entrada; no es trailing. Puede activarse en la vela de entrada después de la apertura. Si la apertura salta el stop, se ejecuta a esa apertura con deslizamiento, sin asumir una ejecución imposible al nivel del stop.
- Una operación con todo el capital a la vez permite comparar con la aplicación. No representa una recomendación de tamaño de posición.
- Las posiciones pendientes al final se liquidan al último cierre con costos y se incluyen en retorno, acierto y profit factor; el JSON distingue estas salidas con `END` y aporta `signalTrades`.
- Drawdown calculado sobre patrimonio a cierre de vela y liquidación final. Puede subestimar la caída intravela. Profit factor calculado sobre P&L monetario neto con capitalización.
- Ocho discontinuidades en los datos: cuatro en 2018, tres en 2019 y una en 2020. Se conservan y enumeran en el JSON; no se inventan velas. RSI/ATR/EMA avanzan por observaciones disponibles y una orden pendiente se ejecuta en la apertura disponible siguiente. El tratamiento de esas discontinuidades es una limitación del desarrollo.
- Cada ventana anual comienza con efectivo y termina liquidando su posición. Sus rendimientos no se multiplican para obtener el recorrido continuo.

Reproducción: `node analysis/rsi-study.cjs`. Datos cacheados en `analysis/btc-usdt-4h.json`; resultados completos, operaciones, parámetros, discontinuidades y SHA-256 en `analysis/rsi-results.json`.

## Evaluación final: 2025-01-01 a 2026-11-03 UTC

Los porcentajes de retorno son acumulados del período, no anualizados. Todas las variantes usan RSI(14) 30/70 salvo indicación.

| Variante | Retorno neto | Drawdown | Operaciones¹ | Acierto | Profit factor |
|---|---:|---:|---:|---:|---:|
| Actual: entrar bajo 30, salir sobre 70 | −12,1% | 44,8% | 17 | 64,7% | 0,83 |
| Entrar al recuperar 30, salir sobre 70 | −17,9% | 44,7% | 17 | 64,7% | 0,74 |
| Recuperar 30 y salir al perder 70 | −22,0% | 45,8% | 17 | 64,7% | 0,68 |
| Entrada actual + stop 3 ATR | +7,2% | 31,2% | 32 | 40,6% | 1,08 |
| Recuperar 30 + stop 3 ATR | −7,5% | 36,5% | 36 | 38,9% | 0,93 |
| Recuperar 30 + stop + cierre sobre EMA200 4h | −10,9% | 14,6% | 5 | 20,0% | 0,28 |
| Recuperar 30 + cierre sobre EMA200, sin stop | −8,8% | 25,1% | 4 | 50,0% | 0,43 |
| Recuperar 30 + stop, salir al perder 70 | −11,7% | 36,9% | 36 | 38,9% | 0,89 |
| RSI(7), recuperar 30 + stop | −23,9% | 37,7% | 93 | 58,1% | 0,84 |
| RSI(14), recuperar 35, salir sobre 65 + stop | −28,4% | 45,8% | 62 | 43,5% | 0,80 |

¹ Incluye liquidación final cuando procede. Buy-and-hold con los mismos costos y período: −18,2%. Mantener efectivo en USDT sin remuneración: 0% en unidades USDT, sin modelar riesgo del emisor ni inflación. Perder menos que BTC no implica obtener beneficio absoluto.

## Validación y estadística

La elegida por Calmar entre las variantes con suficiente muestra de desarrollo fue **recuperar 30 + stop 3 ATR + salida al perder 70**. Su retorno pasó de +420,2% acumulado en 2019–2024 a −11,7% en evaluación; su profit factor final fue 0,89. No se adopta.

El promedio porcentual por operación de esa candidata en evaluación fue −0,18%. Un bootstrap circular de bloques de cinco operaciones, 10.000 remuestras y semilla fija da un intervalo exploratorio del 95% de **−1,65% a +1,53% por operación**. Incluye cero y es amplio. No es un intervalo de rentabilidad futura, no prueba equivalencia entre variantes y no corrige todo el sesgo de selección ni cambios de régimen. Con 36 operaciones no hay base sólida para presentar una ventaja como estable.

Elegir después la entrada actual con stop porque ganó en el período final reutilizaría la evaluación para seleccionar. Su +7,2% se informa como observación exploratoria; necesita otro período prospectivo y sensibilidad de parámetros antes de recomendarla. Con comisión 0,20% y deslizamiento 0,10% por lado produjo **−6,5%**. La candidata elegida en desarrollo produjo −19,7% con esos costos.

El acierto tampoco basta: la regla original acertó 64,7% en evaluación, pero perdió dinero y tuvo PF <1. Pérdidas grandes pueden superar muchas ganancias pequeñas. Los filtros EMA200 reducen exposición y número de operaciones: cinco operaciones de evaluación no permiten concluir que el filtro identifica una ventaja, aunque el drawdown sea menor.

## Ventanas anuales y período reciente

| Año UTC | Actual sin stop | Entrada actual + stop 3 ATR | Elegida en desarrollo |
|---|---:|---:|---:|
| 2019 | −15,8% | −17,2% | +16,4% |
| 2020 | +66,4% | +127,2% | +108,8% |
| 2021 | +15,1% | −5,5% | −5,2% |
| 2022 | −33,3% | +6,5% | +2,4% |
| 2023 | +46,9% | +48,2% | +75,1% |
| 2024 | +18,7% | +3,6% | +16,1% |
| 2025 | +10,4% | +10,6% | −1,0% |
| 2026 hasta el corte | −23,5% | −6,8% | −14,4% |

Últimos 365 días hasta el corte: **−34,2%** actual, **−16,3%** entrada actual con stop y **−25,8%** candidata elegida en desarrollo. Las ventanas son distintas de las cifras históricas móviles anotadas en `config.js`.

## Decisión práctica

No cambiar la aplicación por una supuesta configuración óptima. La prioridad es limitar pérdidas, contabilizar ejecución y costos realistas, y verificar una ventaja futura. La recuperación de 30 es una hipótesis razonable de confirmación, pero aquí rindió peor y no se recomienda por intuición.

Si se continúa investigando la candidata de entrada actual con stop, su especificación queda fijada: RSI(14) 4h, compra al caer bajo 30, venta al superar 70 y stop fijo a 3 ATR(14), ejecución en apertura siguiente. La salida por stop tiene prioridad sobre esperar sobrecompra. Probarla prospectivamente y revisar el vecindario de parámetros sin reutilizar la evaluación como nuevo entrenamiento.

Para una prueba con riesgo limitado puede investigarse arriesgar 0,5% del patrimonio por operación, con tamaño aproximado `patrimonio × 0,005 / (entrada − stop)`, descontando margen para costos y limitando el nominal al efectivo disponible. Es un supuesto nuevo no evaluado aquí. Un stop no garantiza limitar la pérdida si hay saltos de precio. Reducir tamaño reduce exposición; no convierte una expectativa negativa en positiva.

Si se exige vender exclusivamente en sobrecompra, sin ninguna salida de protección, estas pruebas no respaldan recomendar la estrategia para obtener beneficio consistente.

## Verificación y fuentes

El simulador independiente reproduce el saldo final de producción para la regla original al ejecutar al mismo cierre y quitar el deslizamiento. Dos comprobaciones sintéticas verifican ejecución en apertura siguiente y salto a través del stop. No se modificaron parámetros ni código de producción.

- [Documentación oficial Binance: velas spot](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints).
- [Fidelity: RSI](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI). El RSI puede permanecer en extremos durante tendencias fuertes; 30/70 no garantiza reversión.
- [Bailey et al.: The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf). Buscar y elegir estrategias por resultados históricos genera sesgo de selección; una separación temporal por sí sola no elimina el problema.

Relacionado: [RSI reversión a la media](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md).
