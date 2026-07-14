# Bitácora de Operaciones (Wiki Log)

Registro cronológico y persistente de todas las operaciones realizadas sobre la base de conocimientos del LLM Wiki (ingestas, modificaciones, auditorías y simulaciones).
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
