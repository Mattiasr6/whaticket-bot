# Pipeline: BotCajero — Bot moderador WhatsApp + asistente admin por comandos privados (backend Node.js)

## Phase: perf

## Fase 4: Performance — COMPLETADA ✅

### Score: 🟡 REGULAR (5 High, 6 Medium)

Reporte completo: `handoff/perf-report-botcajero.md`

### 🔴 High (5)
1. `readFileSync` bloqueante en stickers — bloquea event loop
2. Bienvenidas secuenciales sin paralelismo — riesgo 429
3. Config+FAQs cargados de DB en CADA mensaje — sin cache
4. Double-scan config: AntiSpam + FAQAutoReply mismo findOne
5. BotCajero 43KB estático en bundle 1.6MB — sin React.lazy()

### 🟡 Medium (6)
- Sin delay entre participantes
- Loop lineal 50+ FAQs sin límite
- DeleteConfigService no limpia Redis keys
- Buffer temporal innecesario en /sticker
- Sin flag anti-overlap en setInterval
- Sin rate limiting global en API

### Recomendación principal
Cachear config + FAQs + SpamRules en Redis TTL 60s → elimina ~99% queries en hot path.
