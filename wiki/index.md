# Índice del LLM Wiki

Bienvenido al Wiki personal de estrategias de trading cuantitativo. Este espacio actúa como base de conocimiento persistente para recopilar, interconectar y analizar las ideas de inversión y resultados de backtesting en criptomonedas.

---

## 🛠️ Estrategias de Trading

- [Cruce de Medias Móviles (EMA/SMA)](file:///c:/Users/gira/Desktop/backtesting/wiki/cruce_de_medias.md)
  - *Crossover de medias rápido/lento para capturar tendencias fuertes de mercado.*
- [RSI Reversión a la Media](file:///c:/Users/gira/Desktop/backtesting/wiki/rsi_reversion_media.md)
  - *Identificación de rebotes en niveles de sobreventa (30) y sobrecompra (70) en el oscilador RSI.*
- [Cruces de MACD](file:///c:/Users/gira/Desktop/backtesting/wiki/macd_crossover.md)
  - *Uso del MACD y su línea de señal para detectar giros de momento y tendencia.*
- [Bandas de Bollinger](file:///c:/Users/gira/Desktop/backtesting/wiki/bandas_de_bollinger.md)
  - *Estrategia de contratendencia y volatilidad basada en rupturas de desviaciones estándar.*
- [El Método Wyckoff](file:///c:/Users/gira/Desktop/backtesting/wiki/metodo_wyckoff.md)
  - *Metodología institucional basada en el análisis de rangos de acumulación/distribución, volumen y liquidez.*
- [Smart Money Concepts (SMC)](file:///c:/Users/gira/Desktop/backtesting/wiki/conceptos_smart_money.md)
  - *Estudio estructural y probabilístico de liquidez interbancaria, order blocks e integración matemática con Fibonacci.*

---

## 🔬 Análisis y Optimización

- [Mejoras de Acierto y Retorno](file:///c:/Users/gira/Desktop/backtesting/wiki/mejoras_acierto_retorno.md)
  - *Vectores concretos para mejorar win rate y retorno total: filtros de entrada, gestión de SL/TP, régimen de volatilidad, MTF y sizing.*
- [VWAP + EMA Cruce — Barrido de Periodos EMA (7/14 vs 21/30)](file:///c:/Users/gira/Desktop/backtesting/wiki/ema_periodos_cortos_vs_2130.md)
  - *Backtest real de todas las combinaciones fast/slow entre {7,14,21,30}: 21/30 sigue siendo el mejor punto del vecindario; 7/14 degrada acierto, retorno y drawdown.*
- [VWAP + EMA Cruce — Filtro de Confirmación por Cuerpo de Vela](file:///c:/Users/gira/Desktop/backtesting/wiki/filtro_cuerpo_vela_cruce_ema.md)
  - *Exigir cuerpo real (no mecha/doji) en la vela de cruce mejora los pares EMA cortos pero reduce el retorno del 21/30 validado al filtrar trades ganadores; no se recomienda adoptarlo sobre los parámetros actuales.*
- [VWAP + EMA Cruce — Take-Profit basado en Soporte/Resistencia](file:///c:/Users/gira/Desktop/backtesting/wiki/soporte_resistencia_take_profit_ema.md)
  - *Usar pivotes S/R (misma técnica de la Estrategia 1) como target sube el acierto a 82.4% pero recorta el retorno del 21/30 a menos de la mitad; no supera al target fijo 1:1 actual.*
- [VWAP + EMA Cruce — Confirmación MTF con EMA Diaria](file:///c:/Users/gira/Desktop/backtesting/wiki/confirmacion_mtf_diaria_ema.md)
  - *La mejora #8 del roadmap evaluada y rechazada: el gate de EMA50 diaria recorta el retorno a la mitad y vuelve negativa la ventana 2025; EMA20d es el cuarto espejismo de régimen detectado. Con esto, todos los vectores del roadmap aplicables a la Estrategia 2 quedan evaluados.*
- [VWAP + EMA Cruce — Temporalidades 1h y Diario](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_temporalidades_1h_1d_ema.md)
  - *La estrategia no funciona fuera de 4h: en 1h el ruido y las comisiones la dejan en break-even; en 1d los drawdowns son del 24-52% y los parámetros de 4h pierden −27%. La temporalidad 4h es parte del núcleo de la ventaja.*
- [VWAP + EMA Cruce — Análisis Profundo de Mejora (3000 velas)](file:///c:/Users/gira/Desktop/backtesting/wiki/analisis_profundo_mejoras_ema.md)
  - *Barrido total sobre historia ampliada: ninguna combinación mejora retorno y acierto a la vez; el baseline depende del régimen (en 2025 rinde +8.5%, PF 1.27); filtros de volumen y Bollinger detectados como espejismos de régimen; único candidato robusto: filtro percentil ATR.*

---

## 📈 Conceptos Clave & Configuración

- [Esquema del Wiki (.agents/AGENTS.md)](file:///c:/Users/gira/Desktop/backtesting/.agents/AGENTS.md)
  - *Instrucciones y estándares de mantenimiento de la base de datos.*
- [Bitácora de Operaciones (log.md)](file:///c:/Users/gira/Desktop/backtesting/wiki/log.md)
  - *Registro chronological de actualizaciones e ingestas.*

---

## 📚 Fuentes de Información (Sources)

- [Guía de Estudio: El Método Wyckoff](file:///c:/Users/gira/Desktop/backtesting/wiki/sources/wyckoff_guia.md)
  - *Transcripción y resumen de la teoría de Rubén Villahermosa.*
- [Paper: Integración de SMC y Fibonacci](file:///c:/Users/gira/Desktop/backtesting/wiki/sources/smc_fib_paper.md)
  - *Trabajo de investigación de Gapat et al. (2026) que cuantifica matemáticamente las zonas HPZ.*
