---
title: "RSI long: objetivo de dos operaciones mensuales en cinco años"
type: analysis
tags: [btc, rsi, long-only, frequency, statistics, vwap]
created: 2026-11-03
last_updated: 2026-11-03
---

# RSI long: dos o más operaciones mensuales

## Resultado principal

La estrategia actual es muy selectiva: **26 operaciones cerradas en cinco años, 0,43 al mes**, frente a unas 120 necesarias para promediar dos. Su retorno acumulado simulado fue **141,9%**, con **17,7% de drawdown a cierre de vela**, pero solo **2 de 59 meses completos** alcanzaron dos operaciones. Hubo **35 meses sin cierres**.

Se estudiaron **972 configuraciones**. 613 alcanzaron al menos dos cierres mensuales de promedio y 48 de ellas tuvieron retorno neto positivo con los costos base. **Ninguna mantuvo retorno positivo al duplicar comisión y deslizamiento.** Esto es sensibilidad a un escenario concreto de costos, no una demostración de que toda estrategia RSI sea inviable ni de que esos costos se apliquen a toda cuenta.

120 configuraciones alcanzaron dos cierres en cada uno de los 59 meses completos. La de mayor beneficio de ese grupo (G0318) ganó apenas **0,1% en cinco años**, con **48,5% de drawdown**; con costos de estrés perdió **-54,1%**. No se recomienda seleccionar por frecuencia exclusivamente.

## Estado actual leído directamente del código

Este estudio sustituye la descripción del código vigente en el análisis anterior, que examinó la antigua regla 30/70. El repositorio ahora implementa en `js/strategy-rsi.js`:

- BTC/USDT 4h, solo long, una posición sin piramidación.
- RSI de Wilder de 14 velas: compra al cruzar hacia abajo de 25.
- VWAP móvil de 1.000 velas superior a su valor de 30 velas atrás como filtro de tendencia.
- Salida predeterminada al cruce del cierre por encima de VWAP(100), o al cruzar RSI por encima de 65. La opción alternativa usa RSI >60.
- Sin stop ni objetivo de precio, con todo el capital disponible.

RSI 25 es más exigente que 30. VWAP(1000) en 4h representa unas 4.000 horas de historia, aproximadamente 167 días; su pendiente se compara en 120 horas. La salida VWAP recupera capital antes de esperar sobrecompra extrema. Esta versión **ya no exige salir exclusivamente en RSI 70**.

Se observaron 77 cruces hacia abajo de RSI 25 en los cinco años; solo 38 coincidieron con VWAP ascendente. Se ejecutaron 26 operaciones completas, porque también se ignoran entradas mientras hay una posición abierta y una compra pendiente final no equivale a cierre. La condición de tendencia fue alcista durante 57,5% de las velas.

## Datos, períodos y ejecución

- Ventana exacta: **2021-11-03 00:00 UTC a 2026-11-03 00:00 UTC**, extremo final excluido. Corte equivalente a 2026-11-02 19:00 en Bogotá. Es un corte fijo reproducible; no incluye la vela en formación.
- Datos: API pública spot Binance, 48996 velas horarias desde abril de 2021 incluyendo calentamiento. Se agregaron barras UTC completas de 2h y 4h. Se contrastaron OHLC de 12245 barras 4h con el histórico nativo guardado.
- Cinco huecos horarios en la descarga: cuatro previos al período de prueba y uno en 2023-03-24. No se rellenaron ni se agregaron barras 2h/4h incompletas. Las órdenes se ejecutan en la apertura disponible siguiente. El JSON conserva el detalle. El hueco dentro de la muestra limita precisión en esas horas.
- Calentamiento previo suficiente para la VWAP más larga de cada temporalidad.
- Entrada/salida en apertura siguiente a la señal de vela cerrada. Comisión base **0,10% por lado**, deslizamiento adverso **0,05% por lado**. Aproximadamente 0,30% de fricción por ida y vuelta, sujeto a variaciones de precio.
- Estrés: comisión 0,20% más deslizamiento 0,10% por lado, aproximadamente 0,60% por ida y vuelta. La tolerancia a costos se evalúa por separado de la rentabilidad base.
- Sin apalancamiento, sin financiación de perpetuos, impuestos ni rendimiento del efectivo. El efectivo y los resultados se expresan en USDT.
- Stop de variantes: fijo a 3 ATR(14), referido al precio de entrada con ATR conocido al cierre de la señal. Si hay un salto más allá del stop, se usa la apertura adversa y deslizamiento. No garantiza la pérdida máxima.
- Drawdown sobre patrimonio a cierre de vela y liquidación final: puede subestimar el riesgo intravela.
- Las posiciones abiertas al final se valoran/liquidan con costos para medir retorno, pero **no cuentan** como operaciones completadas para lograr la cuota. `END` permite identificarlas.
- Los 59 meses de diciembre de 2021 a octubre de 2026 están completos; los dos noviembres parciales se excluyen de cobertura mensual, pero sus operaciones sí entran en el total del período. Los meses son UTC. El promedio mensual utiliza duración efectiva del período, próxima a 60 meses.

Una operación significa **una compra y su venta posterior**, no contar cada orden como una operación diferente. El diagnóstico exige dos roundtrips, no simplemente una compra y una venta en el mes.

## Variables y búsqueda

| Variable | Valores considerados | Consecuencia evaluada |
|---|---|---|
| Temporalidad | 4h, 2h, 1h | Frecuencia, ruido y duración de la operación |
| Período RSI | 14, 10, 7 | Sensibilidad y cantidad de cruces |
| Nivel de entrada | 25, 30, 35 | Escasez de extremos frente a entradas menos profundas |
| Dirección de entrada | Caída bajo el nivel o recuperación hacia arriba | Comprar caída frente a confirmar rebote |
| Tendencia VWAP | 4.000h, 2.000h o sin filtro | Exposición a regímenes y meses sin operar |
| Pendiente VWAP | Comparación en 120h | Se mantiene el horizonte económico entre temporalidades |
| Salida | RSI 60, RSI 70 o VWAP de 400h con tope RSI 65 | Tiempo de ocupación y ganancias/pérdidas |
| Stop | Sin stop o 3 ATR | Riesgo y cierres adicionales, incluidos perdedores |
| Costos | Base y escenario duplicado | Supervivencia de ganancias pequeñas |

Las VWAP se escalan por horas: 1.000 barras de 4h equivalen a 2.000 de 2h o 4.000 de 1h. Cambiar únicamente la etiqueta de temporalidad sin mantener el horizonte mezclaría dos efectos. Los períodos RSI sí se prueban en barras de cada temporalidad.

No se añadieron volumen relativo, divergencias, ADX ni patrones de vela a la optimización. Sus efectos no se pueden afirmar a partir de este estudio. Más filtros no garantizan más señales ni mejores resultados. Tamaño de posición y límite de pérdida monetaria son variables adicionales de riesgo que no se optimizaron: todas las comparaciones usan el mismo nominal del 100% del patrimonio.

### Cambiar una sola variable de la versión actual

| Cambio | Cierres/mes | Meses con ≥2 | Retorno 5 años | Drawdown |
|---|---:|---:|---:|---:|
| entry30 | 0,70 | 22,0% | 42,0% | 29,2% |
| entry35 | 1,07 | 35,6% | 9,6% | 31,6% |
| rsi7 | 1,38 | 50,8% | -18,0% | 41,7% |
| noTrend | 0,70 | 8,5% | 34,7% | 43,9% |
| trend500 | 0,40 | 1,7% | 61,1% | 19,6% |
| exitRsi60 | 0,42 | 1,7% | 102,6% | 16,7% |
| stop3 | 0,48 | 6,8% | 32,8% | 19,8% |

Ninguno de estos cambios aislados alcanza dos cierres mensuales. Los nombres indican: entrada a 30/35, RSI7, sin tendencia, VWAP500, salida RSI60 y stop3ATR respectivamente. Subir el umbral o acortar RSI aumenta frecuencia, pero aquí también reduce mucho el rendimiento. Quitar el filtro no necesariamente multiplica cierres: una posición bajista que tarda en recuperar la salida bloquea nuevas entradas.

## Comparación de configuraciones

Los rendimientos son acumulados netos de cinco años; la columna final usa 2025-11-03 a 2026-11-03. Cobertura significa proporción de los 59 meses completos con al menos dos cierres. PF usa ganancias/pérdidas monetarias de operaciones cerradas, sin valoración END.

| ID | Marco | Cierres | Cierres/mes | Cobertura | Retorno 5a | DD | PF | Último año | Estrés 5a |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| current | 4h | 26 | 0,43 | 3,4% | 141,9% | 17,7% | 20,55 | 7,4% | 123,7% |
| original30_70 | 4h | 51 | 0,85 | 18,6% | -8,0% | 62,9% | 1,00 | -34,2% | -21,3% |
| G0306 | 4h | 156 | 2,60 | 61,0% | 40,0% | 26,4% | 1,18 | -1,5% | -12,4% |
| G0560 | 2h | 136 | 2,27 | 59,3% | 40,5% | 25,7% | 1,22 | -3,5% | -6,6% |
| G0818 | 1h | 177 | 2,95 | 57,6% | 22,5% | 32,5% | 1,10 | -9,3% | -28,0% |
| G0486 | 2h | 143 | 2,38 | 57,6% | 27,3% | 25,1% | 1,18 | -5,4% | -17,1% |

- **current:** reglas actuales descritas arriba. Su alto PF depende de solo 26 operaciones; no elimina riesgo de pérdidas extremas por ausencia de stop.
- **original30_70:** RSI14, comprar bajo 30, vender sobre 70, sin filtro ni stop. No es la versión vigente.
- **G0306:** 4h, RSI7, recuperar 35, VWAP1000 ascendente frente a 30 barras atrás, salida RSI60, sin stop. Promedia 2,60, pero el último año solo produjo 11 operaciones y perdió dinero.
- **G0560:** 2h, RSI7, recuperar 25, VWAP2000 ascendente frente a 60 barras atrás, salida RSI70, sin stop. Es la alternativa de esta tabla que conserva la salida en sobrecompra 70 y supera dos de promedio; tampoco mantiene frecuencia ni beneficio en el último año.
- **G0818:** 1h, RSI10, recuperar 30, VWAP2000 ascendente frente a 120 barras atrás, salida RSI70, sin stop. Aumenta actividad a costa de riesgo y costos.
- **G0486:** 2h, RSI10, recuperar 30, VWAP2000 ascendente frente a 60 barras atrás, salida RSI60, sin stop. Candidata de la segunda etapa exploratoria, descrita abajo. RSI60 es recuperación de momentum, no sobrecompra clásica.

## Separación temporal y límites estadísticos

1. **Desarrollo:** 2021-11-03 a 2024-11-03, tres años. Se exigió retorno positivo, promedio ≥2 cierres/mes, cobertura ≥50% y DD ≤35%. Son criterios de investigación, no tolerancia de riesgo autorizada por el usuario. Cumplieron 59 configuraciones.
2. **Validación:** 2024-11-03 a 2025-11-03. De las diez mejores por Calmar de desarrollo ninguna superó conjuntamente frecuencia, beneficio, DD y costos de estrés.
3. **Ampliación exploratoria explícita:** tras ese fallo se revisaron las 59 elegibles, sin usar el último año en el ranking. Seis pasaron validación; la mejor por Calmar de validación fue G0486. Esta ampliación modifica la selección inicial y debe tratarse como exploratoria.
4. **Evaluación final:** 2025-11-03 a 2026-11-03. G0486 perdió **-5,4%**, con solo **11 cierres**: **0,92/mes**. Se rechazó como solución robusta del objetivo.

Además se calcularon resultados retrospectivos completos de todas las variantes para describir la frontera frecuencia/rentabilidad; esos datos no se utilizaron para elegir G0486. La elección de comparar 972 variantes genera sesgo de selección. El proyecto ya ha usado estos años en análisis previos, por lo que ninguna separación retrospectiva aquí constituye una prueba prospectiva completamente inédita.

En G0486, el bootstrap circular del retorno geométrico mensual sobre los 59 meses completos, bloques de tres meses y 10.000 remuestras, dio un intervalo exploratorio del 95% de **-0,6% a 1,3% al mes**. Incluye cero; no corrige búsqueda múltiple, cambios de régimen ni meses parciales. No representa un intervalo de beneficio futuro garantizado.

Sensibilidad: las diez perturbaciones vecinas de G0486 (RSI ±1, entrada ±2, salida ±2, pendiente ±5 barras y VWAP ±10%) también perdieron en el último año. Algunas dejaron de llegar a dos operaciones promedio. El resultado no se arregla con un pequeño ajuste aislado.

### Cinco ventanas anuales no solapadas

Cada ventana reinicia con efectivo y liquida para valorar su extremo final. Por eso sus retornos no se multiplican para reconstruir la curva continua.

| Ventana UTC | Cierres actual | Retorno actual | Cierres G0486 | Retorno G0486 |
|---|---:|---:|---:|---:|
| 2021-11-03 a 2022-11-03 | 3 | 6,2% | 15 | 2,7% |
| 2022-11-03 a 2023-11-03 | 6 | 11,1% | 32 | -8,1% |
| 2023-11-03 a 2024-11-03 | 7 | 42,7% | 39 | 16,0% |
| 2024-11-03 a 2025-11-03 | 8 | 33,9% | 46 | 24,4% |
| 2025-11-03 a 2026-11-03 | 2 | 7,4% | 11 | -5,4% |

## Decisión

La versión actual conserva una rentabilidad histórica más favorable que las candidatas rápidas estudiadas, pero **no cumple la frecuencia deseada**. Las cifras históricas se apoyan en una muestra pequeña y parámetros previamente elegidos; no bastan para asegurar que mantendrá esa rentabilidad.

Es posible obtener dos o más operaciones al mes **de promedio** relajando extremos y reduciendo temporalidad. En este conjunto no se encontró una candidata que reúna frecuencia sostenida, beneficio fuera del período de selección y resistencia al escenario de costos. Exigir dos en cada mes reduce aún más la calidad económica observada.

No se recomienda cambiar producción para cumplir una cuota de operaciones. Si se investiga una alternativa, congelar sus reglas antes de observar nuevos datos, evaluar cierres/mes y cobertura por separado, y exigir expectativa neta después de costos. Antes de operar debe definirse el riesgo monetario por operación; todo el capital sin stop no es una consecuencia necesaria de usar RSI. El estudio no validó un nuevo esquema de tamaño ni un límite de pérdida.

## Reproducción y verificación

- Ejecutar `node analysis/rsi-frequency-study.cjs` y `node analysis/rsi-frequency-report.cjs`.
- Datos cacheados: `analysis/btc-usdt-1h-five-year.json`; SHA-256 31ea228f728dd95cd58d0b35fd91779cc6ff4698551ee27ae6c8cc44956d8a33.
- Resultados y desglose mensual/operaciones: `analysis/rsi-frequency-results.json`.
- Motor independiente: `analysis/rsi-frequency-engine.cjs`.
- Paridad contra producción con ejecución al mismo cierre y sin deslizamiento: 148,3% acumulado, 26 cierres, igualdad de saldo y tiempos de salida. La diferencia con 141,9% corresponde al modelo de ejecución siguiente apertura y costos de deslizamiento del estudio.
- Comprobaciones sintéticas: siguiente apertura, stop con salto y exclusión de la liquidación END del conteo de cierres.
- Ningún parámetro ni archivo de producción fue modificado.

Fuentes: [velas oficiales Binance](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints), [Fidelity: RSI y persistencia en extremos](https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/RSI), [Bailey et al.: riesgo de sobreajuste en backtests](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf).

Relacionado: [análisis previo de diez variantes](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_rsi_long_4h.md), [conceptos RSI](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md).

## Anexo: cierres por mes completo

| Mes UTC | Actual | G0486 exploratoria |
|---|---:|---:|
| 2021-12 | 2 | 7 |
| 2022-01 | 1 | 4 |
| 2022-02 | 0 | 0 |
| 2022-03 | 0 | 0 |
| 2022-04 | 0 | 0 |
| 2022-05 | 0 | 0 |
| 2022-06 | 0 | 0 |
| 2022-07 | 0 | 0 |
| 2022-08 | 0 | 0 |
| 2022-09 | 0 | 0 |
| 2022-10 | 0 | 0 |
| 2022-11 | 0 | 0 |
| 2022-12 | 0 | 0 |
| 2023-01 | 0 | 0 |
| 2023-02 | 1 | 5 |
| 2023-03 | 1 | 4 |
| 2023-04 | 1 | 3 |
| 2023-05 | 1 | 6 |
| 2023-06 | 1 | 4 |
| 2023-07 | 0 | 4 |
| 2023-08 | 1 | 4 |
| 2023-09 | 0 | 1 |
| 2023-10 | 0 | 1 |
| 2023-11 | 0 | 3 |
| 2023-12 | 0 | 3 |
| 2024-01 | 1 | 4 |
| 2024-02 | 0 | 1 |
| 2024-03 | 0 | 4 |
| 2024-04 | 1 | 6 |
| 2024-05 | 1 | 5 |
| 2024-06 | 1 | 6 |
| 2024-07 | 2 | 3 |
| 2024-08 | 1 | 3 |
| 2024-09 | 0 | 0 |
| 2024-10 | 0 | 1 |
| 2024-11 | 0 | 3 |
| 2024-12 | 0 | 3 |
| 2025-01 | 1 | 5 |
| 2025-02 | 1 | 3 |
| 2025-03 | 1 | 7 |
| 2025-04 | 1 | 2 |
| 2025-05 | 0 | 3 |
| 2025-06 | 1 | 4 |
| 2025-07 | 0 | 3 |
| 2025-08 | 1 | 4 |
| 2025-09 | 1 | 4 |
| 2025-10 | 1 | 4 |
| 2025-11 | 1 | 2 |
| 2025-12 | 0 | 0 |
| 2026-01 | 0 | 0 |
| 2026-02 | 0 | 0 |
| 2026-03 | 0 | 0 |
| 2026-04 | 0 | 0 |
| 2026-05 | 0 | 0 |
| 2026-06 | 0 | 0 |
| 2026-07 | 0 | 0 |
| 2026-08 | 0 | 2 |
| 2026-09 | 0 | 4 |
| 2026-10 | 1 | 4 |
