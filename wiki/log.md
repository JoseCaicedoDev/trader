# Bitácora de Operaciones (Wiki Log)

Registro cronológico y persistente de todas las operaciones realizadas sobre la base de conocimientos del LLM Wiki (ingestas, modificaciones, auditorías y simulaciones).
## [2026-07-13] lint | Eliminación de duplicación + correcciones SOLID/Clean Code
- Continuación de la auditoría de calidad anterior: se pidió explícitamente cero código duplicado y cumplimiento de SOLID/Clean Code. Cada cambio que toca lógica de trading se verificó por equivalencia numérica exacta contra el comportamiento original (backtest real BTC/USDT 4h) antes de aceptarse.
- **`js/strategy-wyckoff.js`** — eliminados ~70 líneas de duplicación entre los bloques LONG (Spring/LPS) y SHORT (UTAD/LPSY), que eran casi espejos exactos. Extraídas 4 funciones puras parametrizadas por `direction` (+1/-1): `computeWyckoffScore`, `isWyckoffEntryGated`, `computeWyckoffStopAndTarget`, `evaluateWyckoffEntry` (cada una <20 líneas). Verificado: mismos 16 trades, mismo `finalBalance` (122.4061), mismo drawdown, mismo `eventLabels` y `currentState` byte a byte contra la versión anterior.
- **`js/strategy-emacross.js`** — colapsados los bloques BUY/SHORT casi idénticos (cálculo de `stopDist` duplicado, luego ramas espejo) en un único camino con un flag `isBullish`. Verificado contra ambos usos reales (`STRATEGY2_PARAMS` 21/30 y `STRATEGY3_PARAMS` 19/45): trades, `finalBalance` y `currentState` idénticos.
- **DIP**: `js/chart/chart-manager.js` (Layer 2) ya no lee el global `EVENT_LABELS` (Layer 3, definido en `dom-utils.js`) directamente — se inyecta ahora vía constructor (`new ChartManager(priceEl, equityEl, accentColor, EVENT_LABELS)`, wired en `js/app/main.js`).
- **DRY**: literal de clase CSS del badge de evento, duplicado en `js/ui/trades-table.js` (dos sitios idénticos), extraído a `CSS_CLASSES.BADGE_EVENT_ENTRY` en `js/ui/dom-utils.js`.
- **OCP**: `js/ui/signal-panel.js` reescrito — eliminado el branching `if (this.type === 'wyckoff')` / `isEthTimeframe` de 3 vías. Ahora recibe `emaFastLabel`/`emaSlowLabel`/`priceDecimals` inyectados por configuración (sourced directamente de `STRATEGY_PARAMS`/`STRATEGY2_PARAMS`/`STRATEGY3_PARAMS` en `main.js`, sin números mágicos nuevos) y decide si mostrar los extras de Wyckoff (badge de evento + Estocástico) por duck-typing sobre la forma del `state` (`'lastEvent' in state`) en vez de un string de tipo — coincide con el contrato ya documentado de que los estados de todas las estrategias comparten una interfaz y los campos extra se ignoran (Liskov). Añadir una Estrategia 4 ya no requiere tocar `SignalPanel`.
- **Clean Code**: `SignalPanel.update()` (antes ~90 líneas) descompuesto en 4 métodos con nombre, cada uno <20 líneas (`updateVwapCheck`, `updateEmaCheck`, `updateWyckoffExtras`, `updatePositionCheck`), cumpliendo el límite de función que el propio `AGENTS.md` documenta.
- **Cambio visible menor**: la etiqueta de estructura EMA de la pestaña Wyckoff pasó de "Estructura alcista (21>50)" a "EMA21 > EMA50 (alcista)" — unifica el formato con las otras dos pestañas, necesario para eliminar el branching por tipo.
- No se modificaron parámetros de estrategia, geometría de stop/target, ni el motor del simulador — solo estructura interna del código, con paridad de comportamiento verificada numéricamente en cada paso.

---

## [2026-07-13] lint | Auditoría de calidad de código + correcciones aplicadas
- Auditoría completa de los 15 archivos `.js` del proyecto por arquitectura, calidad, rendimiento y seguridad (sin herramientas de linting automatizado, revisión manual archivo por archivo).
- Aplicadas 5 correcciones de mayor impacto/menor riesgo, todas verificadas (syntax-check + backtest real produciendo las mismas métricas que antes del cambio):
  1. Eliminado `lucide@latest` de `index.html` — dependencia CDN cargada en cada page load, confirmada sin ningún uso (`createIcons()`/`data-lucide` no existen en el proyecto) y sin versión fijada ni SRI.
  2. `js/live-feed.js` emitía `'error'` sin que nada lo escuchara — errores de WebSocket desaparecían silenciosamente. Añadido listener en `js/app/main.js` que marca el indicador de conexión en rojo y notifica vía `MetricsPanel.setError()`.
  3. `MetricsPanel.setError()` usaba `window.alert()` (`js/ui/metrics-panel.js`), que congela el hilo de JS de las 3 pestañas de estrategia simultáneamente. Reemplazado por el mismo mecanismo de toast no bloqueante que ya usa `alerts.js`.
  4. `calculateRollingVWAP` (`js/indicators.js`) recalculaba la suma de la ventana completa (80 velas) desde cero por cada índice — O(n·period). Reescrito con ventana corrediza — O(n). Relevante porque el tick en vivo cada 1.5s reejecuta la estrategia completa sobre ~1000 velas. Verificado numéricamente idéntico al original (diferencia máxima 1.9e-10, error de punto flotante) y confirmado con un backtest real: mismos 17 trades, mismo 76.5% de acierto, mismo 4.37% de drawdown.
  5. `lastAlertedKeys` (`js/alerts.js`) crecía sin límite durante toda la vida de la pestaña. Añadido tope de 500 entradas con expulsión de la más antigua (FIFO vía orden de inserción del `Set`).
- Hallazgos identificados pero **no** corregidos en esta pasada (quedan documentados para una iteración futura si se solicita): violación DIP de `ChartManager` leyendo `EVENT_LABELS` de Layer 3; duplicación de literal de clase CSS en `trades-table.js`; recomputo completo de la estrategia en el tick en vivo solo para leer `currentState` (arreglo estructural mayor, no aplicado por su alcance); código espagueti en `detectWyckoffEvents`/bloques LONG-SHORT espejo de `strategy-wyckoff.js`.
- No se tocaron parámetros de estrategia ni lógica de señales/simulador — solo infraestructura, manejo de errores y una optimización algorítmica con equivalencia numérica verificada.

---

## [2026-07-13] lint | Actualización completa de AGENTS.md — memoria del sistema
- Auditado `.agents/AGENTS.md` contra el estado real del repo (estructura de `js/`, `index.html`, `main.js`) y corregidas varias desviaciones entre lo documentado y lo real:
  - La "Target Architecture" describía `js/core/*.js` y `js/data/*.js` como rutas objetivo — nunca se ejecutó esa parte del refactor; los archivos Core/Infra siguen planos en `js/` raíz. Corregido el diagrama y añadida nota explícita para no asumir esas carpetas.
  - La tabla de "Architecture Refactor — Pending Implementation" ya estaba 100% completa (incluyendo dos tareas no listadas: consolidación del template HTML5 y `js/alerts.js`) — renombrada a "CLOSED" con el historial correcto.
  - "Directory Structure" no mencionaba `js/alerts.js` (sistema de alertas ya implementado) ni documentaba con precisión las funciones/clases exportadas de cada archivo real.
  - Corregida la inconsistencia "exclusivamente BTC/USDT" vs. la Estrategia 3 (ETH/USDT), ya documentada en otra sección pero contradicha en el encabezado y en la convención #4.
- Reescrita por completo la sección de Strategy 2: roadmap de mejoras marcado como **CERRADO** — resume los 7 análisis realizados en esta sesión (periodos EMA, VWAP fino, rejilla ATR/RR, cuerpo de vela, S/R como TP, filtros de régimen, temporalidades 1h/1d, MTF diario) y la advertencia de dependencia de régimen (+8.47% en 2025 vs +31.4% en la ventana viva).
- Añadida tabla de roadmap dividida: Estrategia 2 (cerrado, con resultado de cada ítem) vs. Estrategia 1 Wyckoff (abierto, sin cambios).
- Añadida sección "WhatsApp Alerts — Deferred Initiative" documentando la iniciativa pausada a pedido del usuario (CallMeBot vs Twilio vs webhook, advertencia de exposición de credenciales en GitHub Pages público).
- Añadidas las 7 páginas de análisis de la Estrategia 2 a la tabla de "Wiki Knowledge Base — Pages" de AGENTS.md (ya estaban en `wiki/index.md`, faltaban en la memoria del agente).
- No se modificó código de producción — esta es una actualización de memoria/documentación exclusivamente.

---

## [2026-07-13] ingest | Confirmación MTF con EMA Diaria — Strategy 2
- Creada página de análisis en [confirmacion_mtf_diaria_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/confirmacion_mtf_diaria_ema.md).
- Validada la mejora MTF del roadmap (gate de tendencia diaria): 3000 velas 4h + 2000 diarias reales, sin lookahead (solo velas diarias cerradas), barrido EMA diaria {20,50,100,200} × modos hard/soft, ventanas LIVE/HIST.
- Resultado: EMA50d (propuesta original) empeora ambas ventanas (LIVE +25.35%→+12.02%, HIST +8.47%→−2.38%); EMA20d es el cuarto espejismo de régimen (PF 5.63 LIVE / 0.93 HIST). Causa: la EMA diaria retrasa tanto que el movimiento del cruce 4h ya está gastado cuando confirma, y bloquea los trades contra-tendencia ganadores.
- Con esto, todos los vectores del roadmap aplicables a la Estrategia 2 quedan evaluados y rechazados; la configuración 21/30/vwap80/atr2.0/rr1.0 en 4h se confirma como óptimo robusto definitivo del espacio explorado.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".

---

## [2026-07-13] ingest | Temporalidades 1h y 1d — Strategy 2
- Creada página de análisis en [analisis_temporalidades_1h_1d_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_temporalidades_1h_1d_ema.md).
- Replicado el análisis profundo en 1h (6000 velas, nov 2025→jul 2026) y 1d (3000 velas, abr 2018→jul 2026): barrido de 8 pares EMA × 7 VWAP × rejilla atrMult×rrRatio en ventanas LIVE/HIST.
- 1h: descartada — baseline en break-even (PF 0.87-1.00), ruido y comisiones consumen la ventaja; ninguna configuración estable en ambas ventanas. 1d: descartada — parámetros 4h pierden −27.49% en LIVE; las configuraciones positivas (7/21, vwap55) cargan drawdowns del 24-52%.
- Conclusión: la temporalidad 4h es parte del núcleo de la ventaja; el diario solo tendría uso como filtro MTF (mejora #8 del roadmap), no como temporalidad de operación.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".

---

## [2026-07-13] ingest | Análisis Profundo de Mejora (3000 velas) — Strategy 2
- Creada página de análisis en [analisis_profundo_mejoras_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md).
- Historia ampliada a 3000 velas 4h (mar 2025 → jul 2026) vía paginación de Binance; ventana HIST (~1800 velas previas) usada como out-of-sample verdadero del pasado.
- Ejes probados: rejilla atrMult×rrRatio, barrido vwapPeriod, breakeven/trailing stop (roadmap #6), filtro de volumen, filtro percentil ATR (roadmap #3), filtro Bollinger (roadmap #7), LONG/SHORT-only, y combos.
- Hallazgo principal: el baseline 21/30 depende del régimen — en HIST rinde 61.3% WR, +8.47%, PF 1.27 (vs 75-76%, +25-31%, PF 3.1-3.5 en LIVE). Detectados dos espejismos de régimen que se habrían adoptado sin la ventana HIST: filtro Bollinger (PF 6.76 LIVE / 1.01 HIST) y filtro de volumen (PF 3.94 LIVE / 0.32 HIST).
- Conclusión: ninguna combinación mejora retorno y acierto a la vez; mantener parámetros actuales. Único candidato robusto: filtro percentil ATR ≤0.5-0.6 (mejora HIST, recorta LIVE — decisión de perfil de riesgo). Mejoras #4/#6/#7 del roadmap marcadas como evaluadas y rechazadas para la Estrategia 2.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".
- Adenda: barrido fino de vwapPeriod 20→80 en pasos de 5 × 3 pares EMA. VWAP 20-50 desastroso (hasta −30% LIVE); picos secundarios aislados en 55 y 65 (mejores en HIST pero vecinos colapsan — frágiles); se mantiene vwap80.

---

## [2026-07-13] ingest | Take-Profit basado en Soporte/Resistencia — Strategy 2
- Creada página de análisis en [soporte_resistencia_take_profit_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/soporte_resistencia_take_profit_ema.md).
- Experimento aislado (sin modificar `js/strategy-emacross.js`): reutilizada `detectSwingLevels` (misma técnica sin lookahead de la Estrategia 1 Wyckoff) como target de TP para la Estrategia 2, en dos modos (`cap`: usar S/R si está más cerca que el target fijo; `extend`: usarlo si está más lejos), barrido sobre 3 combos EMA × 3 modos + sensibilidad de `srBars` (5-20) sobre 21/30.
- Resultado: modo `cap` sube el win rate del 21/30 de 76.5%→82.4% pero recorta el retorno de +31.40% a +14.00% (toma ganancias antes de tiempo); modo `extend` empeora las tres métricas a la vez. Ningún modo supera el retorno del target fijo actual. No se recomienda modificar la estrategia.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".

---

## [2026-07-13] ingest | Filtro de Confirmación por Cuerpo de Vela — Strategy 2
- Creada página de análisis en [filtro_cuerpo_vela_cruce_ema.md](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md).
- Experimento aislado (sin modificar `js/strategy-emacross.js`): filtro `bodyMinRatio` que exige que la vela de cruce cierre con cuerpo real direccional (no mecha/doji), barrido contra 6 combos EMA fast/slow × 4 umbrales (0/0.3/0.5/0.7), validado IS/OOS por separado.
- Resultado: mejora sustancialmente los pares EMA cortos previamente descartados (7/21 pasa de 64.3%→81.3% win rate, PF 1.51→3.25 con body≥0.5) pero reduce el retorno del par validado 21/30 (31.40%→9.42% con body≥0.3) al filtrar trades ganadores junto con los de mecha. Ningún par filtrado supera el retorno combinado del 21/30 sin filtro. No se recomienda adoptar el filtro sobre los parámetros actuales.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".

---

## [2026-07-13] ingest | Barrido de Periodos EMA — Strategy 2 (7/14 vs 21/30)
- Creada página de análisis en [ema_periodos_cortos_vs_2130.md](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md).
- Ejecutado el motor real (`indicators.js` + `simulator.js` + `strategy-emacross.js`) contra ~1000 velas 4h BTC/USDT en vivo de Binance, barriendo todas las combinaciones fast/slow del conjunto {7,14,21,30}, con validación separada in-sample (70%) / out-of-sample (30%) por vector de mejora #7 y la advertencia de overfitting de AGENTS.md.
- Resultado: 7/14 rinde ~0.55% de retorno combinado, 54.8% win rate, PF 1.05 (break-even) — estrictamente peor que 21/30 (31.40%, 76.5%, PF 3.49) en las tres ventanas medidas. Confirmada tendencia monótona: acortar los periodos degrada acierto y retorno. Se recomienda mantener 21/30 sin cambios.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo "Análisis y Optimización".

---

## [2026-07-14] ingest | Refactorización de Clean Architecture y Template DRY HTML5
- Implementada la Fase 2 a 6 de la refactorización DRY/SOLID aprobada en el plan.
- Reemplazada la duplicación masiva en `index.html` con un único `<template id="strategy-view-template">` reduciendo el archivo en un **60%** (de 714 a 311 líneas).
- Adaptados todos los componentes de UI (`MetricsPanel`, `SignalPanel`, `TradesTable`, `StrategyView`) para realizar búsquedas relativas a la raíz del template clonado (`viewRoot`).
- Modificado `main.js` para instanciar dinámicamente las tres vistas a partir del array de configuraciones `STRATEGIES_CONFIG`, reduciendo la duplicación y permitiendo escalabilidad ilimitada.
- Adaptado `alerts.js` para enlazar los selectores de sonidos, pruebas y solicitudes a notificaciones mediante clases, sincronizando los estados de forma global.
- Verificado el correcto funcionamiento del dashboard en el navegador sin errores y desplegado en producción en GitHub Pages.

---

## [2026-07-13] ingest | Sistema de Alertas y Notificaciones en Vivo
- Creado módulo [alerts.js](file:///c:/Users/gira/Desktop/backtesting/js/alerts.js) para gestionar las notificaciones y alarmas.
- Integrado soporte nativo para la API de Notificaciones HTML5 de escritorio (con solicitud de permiso reactiva).
- Implementado sintetizador de sonido premium mediante la API de Web Audio (para beeps dobles ascendentes en LONG y descendentes en SHORT) sin dependencias de red.
- Creada interfaz de configuración en el menú lateral de cada estrategia (`index.html`) sincronizada en tiempo real.
- Creado sistema visual de alertas de tipo Toast slide-in animadas por CSS como fallback.
- Modificados archivos de estrategia y live feed para inyectar y detectar eventos en tiempo real evitando spam de alertas.

---

## [2026-07-13] ingest | Clean Code & Architecture Standards — AGENTS.md
- Añadida sección completa "Clean Code & Architecture Standards" al [.agents/AGENTS.md](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md).
- Define la arquitectura objetivo en 4 capas (Core, Infrastructure, UI Components, App Bootstrap) con reglas de dependencia estrictas entre capas.
- Documenta los 5 principios SOLID con reglas de enforcement concretas y señales de violación para cada uno.
- Especifica convenciones de nomenclatura, límites de función (20 líneas máx.), manejo de estado, y reglas de comentarios (WHY not WHAT).
- Lista de anti-patterns prohibidos: funciones numeradas (fn1/fn2/fn3), `var`, globals implícitos, innerHTML en bucles, listeners duplicados, strings CSS hardcodeados en JS.
- Estándares de HTML semántico: `<main>`, `<nav>`, `<aside>`, `<section>`, `<article>`, `<header>` + atributos ARIA obligatorios.
- Estándares de performance: DocumentFragment, ResizeObserver, requestAnimationFrame, throttle de 1500ms para live signal.
- Design tokens CSS en `:root` y objeto `CSS_CLASSES` centralizado en `dom-utils.js`.
- Checklist de code review de 12 puntos y tabla de tareas de refactor pendientes con estado ⬜/✅.
- Creado plan de implementación detallado en el artifact `implementation_plan.md`.

---

## [2026-07-13] ingest | Actualización de Contexto Completo — AGENTS.md
- Reescrito [.agents/AGENTS.md](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md) con la memoria completa del sistema acumulada hasta la fecha.
- Añadida sección "Project State": describe la app (Antigravity Backtester), las dos estrategias con toda su lógica validada y parámetros, el motor de simulación, el inventario completo de páginas del wiki, el roadmap de mejoras pendientes, y las restricciones técnicas críticas (no-lookahead, validación out-of-sample, CORS Binance).
- El AGENTS.md ahora funciona como **memoria del sistema**: todo agente que lo lea tiene el contexto completo del proyecto sin necesidad de analizar el código fuente.

---

## [2026-07-13] ingest | Mejoras de Acierto y Retorno — Análisis de Estrategias
- Creada página de análisis en [mejoras_acierto_retorno.md](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md).
- Cubre 9 vectores de mejora concretos para las estrategias Wyckoff Unificada y VWAP+EMA Cross: calidad de entrada (score LPS>=2, R:R mínimo 1.5, volumen en Spring), gestión SL/TP (trailing stop, TP escalonado), filtro de régimen de volatilidad (ATR percentile, Bollinger), confirmación multi-timeframe diaria, scoring RSI+StochRSI, y sizing proporcional al score.
- Vinculada en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md) bajo la sección "Análisis y Optimización".

---

## [2026-07-13] ingest | Smart Money Concepts & Fibonacci Ratios
- Ingestado artículo científico sobre la integración matemática de SMC y Fibonacci en [smc_fib_paper.md](file:///c:/Users/gira/Desktop/backtesting/wiki/sources/smc_fib_paper.md).
- Creado documento de síntesis teórica en [conceptos_smart_money.md](file:///c:/Users/gira/Desktop/backtesting/wiki/conceptos_smart_money.md) detallando la teoría estructural, el modelado probabilístico de campanas gaussianas de Fibonacci, las métricas de acierto (72% HPZ) y las directrices aplicadas a BTC.
- Vinculados los nuevos archivos en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md).

---

## [2026-07-13] ingest | Detalle del Método Wyckoff (Wyckoff Analytics)
- Añadida fuente web a [wyckoff_guia.md](file:///c:/Users/gira/Desktop/backtesting/wiki/sources/wyckoff_guia.md).
- Modificado [metodo_wyckoff.md](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md) para incorporar el enfoque de 5 pasos, los 9 test de compra/venta, y las directrices de cálculo de objetivos de precio usando conteo horizontal de Punto y Figura (P&F).

---

## [2026-07-13] ingest | El Método Wyckoff (Guía de Estudio)
- Ingestada la guía de estudio del Método Wyckoff como fuente original en [wyckoff_guia.md](file:///c:/Users/gira/Desktop/backtesting/wiki/sources/wyckoff_guia.md).
- Creada página de síntesis teórica en [metodo_wyckoff.md](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md) con leyes, eventos, fases y directrices de aplicación exclusivas para BTC/USDT.
- Vinculados los nuevos archivos en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md).

---

## [2026-07-13] ingest | Restricción de par a BTC
- Modificado [.agents/AGENTS.md](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md) para registrar la exclusividad de análisis en el par BTC/USDT.
- Modificado [index.html](file:///c:/Users/gira/Desktop/backtesting/index.html) para dejar el selector de activos configurado únicamente en BTC/USDT (Bitcoin).

---

## [2026-07-13] ingest | Inicialización del LLM Wiki y Estructura
- Creado archivo de configuración del esquema del wiki en [.agents/AGENTS.md](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md).
- Creado catálogo centralizado en [index.md](file:///c:/Users/gira/Desktop/backtesting/wiki/index.md).
- Documentada estrategia de tendencia en [cruce_de_medias.md](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md) con resultados de simulación iniciales para BTC/USDT.
- Documentada estrategia osciladora en [rsi_reversion_media.md](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md) con pruebas de parámetros.
- Documentada estrategia de momentum en [macd_crossover.md](file:///c:/Users/gira/Desktop/backtesting/wiki/macd_crossover.md).
- Documentada estrategia de volatilidad y reversión en [bandas_de_bollinger.md](file:///c:/Users/gira/Desktop/backtesting/wiki/bandas_de_bollinger.md).
