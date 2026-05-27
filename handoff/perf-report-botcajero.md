# Reporte de Performance — BotCajero

> Auditoría: 2026-05-26 | Stack: Node.js + TypeScript + Express + Sequelize + MySQL + Redis (backend), React 16 + MUI 4 + Vite (frontend)

---

## Score General: 🟡 REGULAR

El módulo funciona correctamente en escenarios típicos (1 admin, 1 grupo, pocas FAQs). Concurrencia media (>3 eventos simultáneos) y escalado (>50 FAQs, >50 configs) revelan problemas de diseño.

---

## 1. Concurrencia — Bienvenidas Simultáneas

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **HIGH** | `GroupParticipantHandler.ts` L43-49 | **`readFileSync` bloqueante por sticker**: cada bienvenida lee el sticker del disco sincrónicamente. Si 3 personas entran a la vez, son 3 `readFileSync` que bloquean el event loop. | Reemplazar con `fs.promises.readFile()` y `await`. O cachear los buffers de stickers en un Map en memoria (si el pool es pequeño). |
| **HIGH** | `GroupParticipantHandler.ts` L26-90 | **for...of secuencial sin paralelismo**: 3 participantes = 3 bienvenidas secuenciales. Cada una: sendMessage(sticker) + sendMessage(rules) + Log.create(). 3 × 3 ops = 9 ops secuenciales. | Paralelizar independencias: welcome y sticker pueden ser simultáneos con `Promise.all()`. El log puede ir al final sin await. |
| **MEDIUM** | `GroupParticipantHandler.ts` L40-64 | **Sin rate-limit awareness**: 3 bienvenidas simultáneas generan 3 stickers + 3 mensajes grupo + 3 privados = 9 llamadas a WhatsApp API en <5s. Riesgo de 429. | Introducir delay de 1-2s entre participantes: `await delay(1500)`. O usar cola de mensajes. |
| **LOW** | `GroupParticipantHandler.ts` L43-45 | **Sticker aleatorio por iteración OK** ✅: `Math.floor(Math.random() * stickers.length)` se ejecuta en cada iteración, dando stickers distintos (o iguales por azar). | — |

### Impacto estimado
- 3 personas entrando: ~9 llamadas WhatsApp API en ~4s → **ALTA probabilidad de 429** en WhatsApp
- readFileSync bloquea event loop ~5-20ms por sticker → ~15-60ms de bloqueo adicional
- **Fix**: paralelizar + readFile async + delay entre participantes → reduce riesgo 429 significativamente

---

## 2. FAQ Matching Performance

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **HIGH** | `FAQAutoReply.ts` L44-46 | **Carga config en CADA mensaje**: `BotCajeroConfig.findOne()` se ejecuta por cada mensaje de grupo, incluso si el bot no está configurado para ese grupo. Igual en AntiSpamService. Son 2 queries duplicadas por mensaje. | Cachear config en Redis (TTL 60s) con clave `botcajero:config:{whatsappId}:{groupJid}`. O compartir la instancia ya cargada entre servicios (ver punto 3). |
| **HIGH** | `FAQAutoReply.ts` L67-70 | **Carga TODAS las FAQs activas en CADA mensaje**: `BotCajeroFAQ.findAll()` se ejecuta por cada mensaje del grupo, incluso si el FAQ no va a matchear (mayoría de los casos). 50 FAQs × 1000 mensajes/día = 50,000 queries. | Cachear FAQs en Redis como JSON (clave `botcajero:faqs:{configId}`, TTL 300s). Invalidar al crear/editar/eliminar FAQ. |
| **MEDIUM** | `FAQAutoReply.ts` L74-97 | **Loop lineal sobre 50+ FAQs para cada mensaje**: si hay 50 FAQs con matchType "contains" y el mensaje no matchea ninguna, se evalúan las 50 antes de retornar false. | Early exit optimizado: FAQs con mayor prioridad primero ya está implementado (ORDER BY priority). Pero agregar un límite máximo de FAQs a evaluar (ej. top 20) + cachear keywords pre-compiladas. |
| **LOW** | `FAQAutoReply.ts` L8-36 | **keywordsMatch() O(k) por FAQ**: cada FAQ con N keywords hace N chequeos `includes()`. Para 50 FAQs × 3 keywords = 150 operaciones de string. Aceptable para pocos mensajes. | Pre-compilar keywords en un solo regex: `new RegExp(keywords.join('|'), 'i')` para matchType "contains". Pasa de O(k) por FAQ a O(1) por FAQ. |

### Impacto estimado
- Por mensaje de grupo sin match (caso normal): 1 config query + 1 FAQs query + 50 keyword evaluations
- 1000 mensajes/día × 50 FAQs = 50,000 queries SQL + 50,000 iteraciones de matching
- **Fix**: cache en Redis → elimina ~49,900 queries SQL/día

---

## 3. Anti-Spam + FAQ Ordering

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **MEDIUM** | `handleWhatsappEvents.ts` L395-404 vs L407-414 | **Orden correcto ✅**: anti-spam se ejecuta antes que FAQ, y `if (spamDetected) return` evita doble procesamiento. | — |
| **HIGH** | `AntiSpamService.ts` L17-19 + `FAQAutoReply.ts` L44-46 | **Double-scan de config**: Ambos servicios hacen `BotCajeroConfig.findOne()` idéntico por mensaje. Son 2 queries en vez de 1. | Pasar la `config` ya cargada como argumento, o usar un helper compartido que cargue config + FAQs + SpamRules en una sola query con `include`. |
| **LOW** | `handleWhatsappEvents.ts` L389-391 | **Redis lastmsg setea incluso si spam/FAQ**: correcto (timestamps deben actualizarse). | — |

### Impacto estimado
- 1 query duplicada por mensaje → 1000 queries extra/día con 1000 mensajes
- **Fix**: compartir config object → elimina 50% de queries en hot path

---

## 4. Redis Usage

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **MEDIUM** | `handleWhatsappEvents.ts` L386-391 | **`botcajero:lastmsg` se escribe en CADA mensaje**: ~1 SET por mensaje de grupo. Con 1000 mensajes/día por grupo, no es problema. Pero si hay 100 grupos con BotCajero, son 100,000 writes/mes. Aceptable para Redis. | — (volumen aceptable) |
| **MEDIUM** | `handleWhatsappEvents.ts` L386 | **Sin TTL en claves Redis** (por diseño): las claves `lastmsg` e `icebreaker` nunca expiran. Si se elimina una config de BotCajero, las claves Redis HUÉRFANAS quedan para siempre. | Agregar cleanup en `DeleteConfigService.ts` que borre las claves Redis asociadas: `del(botcajero:lastmsg:{whatsappId}:{groupJid})` y `del(botcajero:lasticebreaker:{...})`. |
| **LOW** | Varios | **Crecimiento lineal**: 2 keys por config activa. 100 configs = 200 keys ≈ insignificante (~20KB). No hay memory leak real. | — |

### Impacto estimado
- Sin cleanup: si se crean/eliminan 100 configs en un año → 200 keys huérfanas (~20KB). Irrelevante.
- **Fix**: cleanup en DeleteConfigService → buena práctica, bajo impacto.

---

## 5. InactivityReminderService — setInterval 30min

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **MEDIUM** | `server.ts` L28-41 | **Manejo de errores por config correcto ✅**: cada config tiene su propio try/catch. Si una falla, las demás continúan. | — |
| **LOW** | `InactivityReminderService.ts` L33-34 | **2 reads de Redis por config**: `GET lastmsg` + `GET icebreaker`. Con 100 configs = 200 GETs cada 30min. Insignificante. | — |
| **LOW** | `server.ts` L28-41 | **Overlap risk**: si el check tarda >30min (100 configs × ~100ms c/u = 10s, improbable). Con 1000 configs teóricos = 100s → podría overlap. | Agregar flag `isRunning` para evitar doble ejecución si el ciclo anterior no terminó. |
| **LOW** | `InactivityReminderService.ts` L20-22 | **Carga config dentro del servicio**: `BotCajeroConfig.findOne()` se ejecuta para cada config, aunque el `server.ts` ya cargó todas las configs arriba (pero no pasa la data). | El `setInterval` en `server.ts` ya carga todas las configs con `findAll({ where: { autoReplyEnabled: true } })`, pero no las pasa a `checkInactivity`. Refactorizar para pasar la config ya cargada. |

### Impacto estimado
- Con 100 configs: ~2-5s por ciclo cada 30min → CPU: ~0.1% adicional
- **Fix**: flag anti-overlap + pasar config pre-cargada → baja prioridad

---

## 6. Memoria — Sticker Handling

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **MEDIUM** | `HandlePrivateCommand.ts` L89 | **Buffer en RAM por sticker**: `Buffer.from(mediaPayload.data, 'base64')` con imagen de 5MB → ~3.75MB en heap. 3 concurrentes = ~11MB. Aceptable para server con 512MB+. | OK para uso normal. Considerar streaming si se implementa v2 con video a sticker. |
| **LOW** | `HandlePrivateCommand.ts` L77 | **Validación 5MB correcta ✅**: chequea `Buffer.byteLength(data, 'base64')` antes de crear el buffer definitivo. Esto crea un buffer TEMPORAL para medir. | Usar `data.length * 0.75` para estimar sin crear buffer (base64 → binario ratio 4:3). Ahorra ~3.75MB temporal por sticker. |
| **LOW** | `GroupParticipantHandler.ts` L48 | **readFileSync para cada sticker de bienvenida**: además de bloqueante (punto 1), mantiene el buffer en memoria hasta que se envía. | Cachear stickers en Map global. Leer una vez al startup. |

### Impacto estimado
- Sin cache: cada bienvenida lee disco + alloc ~50-200KB por sticker
- Fix de cache: elimina I/O de disco en todas las bienvenidas futuras

---

## 7. Bundle Size Frontend

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **HIGH** | `routes/index.js` (import de BotCajero) | **BotCajero importado estáticamente**: 43KB (1370 líneas) en el bundle principal de 1.6MB. Si el usuario nunca visita /bot-cajero, pagó el costo igual. | Convertir a `const BotCajero = React.lazy(() => import("../pages/BotCajero/"))` con `<Suspense>`. Chunk separado ~43KB. |
| **MEDIUM** | `BotCajero/index.js` L2-43 | **37 imports de MUI core + 4 icons**: importa `Grid`, `Card`, `CardMedia`, `CardContent`, `CardActions`, `Tabs`, `Tab`, `Box`, `AppBar`, `TableContainer` etc. Aunque Vite tree-shakea, MUI v4 tiene poor tree-shaking. | Revisar si todos los componentes se usan. Por ejemplo `CardMedia` y `CardActions` se usan en stickers tab, pero podrían no ser críticos en primera paint. Separar tabs en chunks con dynamic import si el page crece. |
| **LOW** | `BotCajero/index.js` | **useStyles grande**: el style object tiene muchas definiciones para 5 tabs. Sin impacto significativo en runtime. | Considerar extraer estilos compartidos. |

### Impacto estimado
- Sin lazy load: +43KB en main bundle (~2.7% del total de 1.6MB)
- Con lazy load: 0KB extra si el usuario no visita la página

---

## 8. API Rate Limiting

### Hallazgos

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **MEDIUM** | `backend/src/app.ts` (global) | **Sin rate limiting global**: 11 endpoints de BotCajero expuestos sin protección contra abuso. Un admin podría spamear PUT/POST/DELETE. | Agregar `express-rate-limit` global (100 req/min) o por endpoint. |
| **LOW** | `ListLogsService.ts` L22 | **Límite 200 logs correcto ✅**: no puede crecer indefinidamente. | — |
| **LOW** | `GetConfigService.ts` | **GET /bot-cajero/:whatsappId** carga config + FAQs + SpamRules + Stickers en una sola query con `include`. ✅ Eager loading, no N+1. | — |

### Impacto estimado
- Sin rate limiting: riesgo bajo (endpoints requieren isAuth + sesión válida)
- **Fix**: express-rate-limit → protección adicional, esfuerzo bajo

---

## Resumen de Hallazgos por Severidad

### 🔴 High (5)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `GroupParticipantHandler.ts` L48 | readFileSync bloqueante por sticker | fs.promises.readFile + cache de stickers |
| `GroupParticipantHandler.ts` L26-90 | Bienvenidas secuenciales sin paralelismo | Promise.all + delay entre participantes |
| `FAQAutoReply.ts` L44-46 + L67-70 | Config + FAQs cargadas de DB en CADA mensaje | Cache en Redis (TTL 60-300s) |
| `AntiSpamService.ts` + `FAQAutoReply.ts` | Double-scan de config por mensaje | Pasar config compartida como argumento |
| `routes/index.js` (import BotCajero) | 43KB estático en bundle 1.6MB | React.lazy() |

### 🟡 Medium (6)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `GroupParticipantHandler.ts` | Sin delay entre participantes → riesgo 429 | Agregar delay 1.5s entre participantes |
| `FAQAutoReply.ts` L74-97 | Loop lineal 50+ FAQs sin límite | Cache + límite top 20 FAQs |
| `DeleteConfigService.ts` | No limpia Redis keys huérfanas | DEL lastmsg + icebreaker al eliminar config |
| `HandlePrivateCommand.ts` L77 | Buffer temporal para medir tamaño | Estimar con `data.length * 0.75` |
| `server.ts` L28-41 | Sin flag anti-overlap en setInterval | isRunning guard |
| APP (global) | Sin rate limiting | express-rate-limit |

### 🟢 Low (4)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `FAQAutoReply.ts` | keywordsMatch() O(k) por FAQ | Pre-compilar regex |
| `InactivityReminderService.ts` | Pasa config no cargada | Refactor para pasar config pre-cargada |
| `BotCajero/index.js` | Import grande de MUI v4 | Revisar imports no usados |
| `GroupParticipantHandler.ts` | Sticker aleatorio OK ✅ | — |

---

## Recomendaciones Priorizadas

### Alta (hacer ahora)
1. **Cachear config + FAQs en Redis** → elimina ~99% de queries SQL en hot path (FAQ + AntiSpam). Impacto: **CRÍTICO** para escalar a +50 grupos.
2. **Paralelizar GroupParticipantHandler** + reemplazar readFileSync con async + agregar delay entre participantes. Impacto: evita 429 en bienvenidas múltiples.
3. **Pasar config compartida** entre AntiSpamService y FAQAutoReply en handleWhatsappEvents.ts. Impacto: elimina 50% queries duplicadas.
4. **React.lazy() para BotCajero**. Impacto: -43KB del bundle principal.

### Media (siguiente sprint)
5. **Cache de stickers** en Map global (leer una vez al inicio). Impacto: elimina I/O bloqueante en todas las bienvenidas.
6. **Limpiar Redis keys** al eliminar config (DeleteConfigService). Impacto: buena práctica, evita datos huérfanos.
7. **Flag anti-overlap** en setInterval de InactivityReminder. Impacto: safety para 100+ configs.

### Baja (cuando haya tiempo)
8. **express-rate-limit** para todos los endpoints. Impacto: seguridad adicional.
9. **Pre-compilar regex** de keywords de FAQs. Impacto: micro-optimización.
10. **Estimar tamaño de imagen** sin crear buffer temporal. Impacto: ahorra ~3.75MB temporal por sticker.

---

## AP: Anti-Patrones Detectados

### AP-1: Query per-message sin cache
Cada mensaje de grupo ejecuta:
1. `handleWhatsappEvents.ts` — `redis.set(lastMsgKey)` → 1 Redis SET
2. `handleAntiSpam()` — `BotCajeroConfig.findOne()` → 1 SQL
3. `handleAntiSpam()` — `BotCajeroSpamRule.findAll()` → 1 SQL
4. `handleFAQAutoReply()` — `BotCajeroConfig.findOne()` → 1 SQL (DUPLICADO)
5. `handleFAQAutoReply()` — `BotCajeroFAQ.findAll()` → 1 SQL

**Total por mensaje: 3 SQL + 1 Redis SET = 4 ops externas.**
Con 1000 msgs/día = 4000 ops. **Cacheando config + FAQs en Redis** → 1 SQL + 1 Redis SET + 1 Redis GET = 2 ops externas. Reducción del 50%.

### AP-2: readFileSync en hot path
`GroupParticipantHandler.ts` usa `readFileSync` para stickers, bloqueando event loop. En Node.js, cualquier operación síncrona en un handler de eventos es una bandera roja.

### AP-3: Sin cleanup de Redis
Las claves `botcajero:lastmsg:*` y `botcajero:lasticebreaker:*` no tienen TTL y no se limpian al eliminar configs. Es un leak mínimo, pero anti-patrón.
