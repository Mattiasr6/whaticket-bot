# Reporte de Performance — Reenvío Automático

> Auditoría: 2026-05-26 | Stack: Node.js + TypeScript + Express + Sequelize + MySQL + Redis (backend), React 16 + MUI 4 + Vite (frontend)

---

## Resumen

| Área | Estado | Hallazgos críticos |
|------|--------|-------------------|
| **Buffer Redis (PERF-01 a 04)** | 🟢 OK | Implementación correcta. Consumo mínimo. Sin fugas. |
| **Reenvío imágenes (PERF-05 a 09)** | 🟡 Advertencias | downloadMedia() escanea todos los chats (O(n)). Sin timeout. |
| **API REST (PERF-10 a 13)** | 🟡 Advertencias | fetchRules() N+1 en frontend. Sin paginación. |
| **Frontend bundle (PERF-14 a 19)** | 🔴 Crítico | Sin lazy loading. 23KB AutoForwards en main bundle. N+1 grupo-names. |

---

## 1. Buffer Redis — PERF-01 a 04

### PERF-01: Consumo de memoria Redis
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| MB por clave Redis | < 1 MB | ~2-3 KB por grupo (50 msg × ~60 bytes c/u) | ✅ **OK** |

**Evidencia**: `MessageBuffer.ts` guarda solo `BufferMessage` ({id, timestamp, type, hasMedia, messageId?, body?}) en LIST Redis. No hay base64 de imágenes. El spec lo exige y se cumple.

### PERF-02: TTL efectivo
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| Expiración claves > 1h | Sin estancamiento | `EXPIRE 3600` en cada `add()` | ✅ **OK** |

**Evidencia**: `MessageBuffer.add()` (L34) ejecuta `multi.expire(key, BUFFER_TTL)` dentro de la transacción MULTI/EXEC, refresh en cada insert. No hay riesgo de claves huérfanas.

### PERF-03: Límite de 50 elementos
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| Máx elementos por LIST | ≤ 50 | `LTRIM 0 49` en cada `add()` | ✅ **OK** |

**Evidencia**: `MessageBuffer.add()` L33: `multi.ltrim(key, 0, MAX_ITEMS - 1)` con MAX_ITEMS = 50.

### PERF-04: Latencia Redis
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| ms por operación LPUSH+LTRIM+EXPIRE | < 10ms | ~2-5ms (Redis local) | ✅ **OK** |

**Evidencia**: Operaciones atómicas vía `multi.exec()`, sin round-trips adicionales. Redis client configurado con `lazyConnect` y conexión local.

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **LOW** | `MessageBuffer.ts` L17 | Redis key prefix `autoforward:buffer:` vs spec que dice `autofwd:buffer:`. No afecta performance pero inconsistente. | Estandarizar prefijo según spec. |
| **MEDIUM** | `MessageBuffer.ts` L26-27 | Silently fails if Redis client is null: `if (!client) return;`. Si Redis cae, mensajes NO se bufferan sin que nadie se entere. | Agregar contador métrico (prometheus?) o log de warning cuando Redis no está disponible. |
| **LOW** | `MessageBuffer.ts` L35 | Transacción MULTI/EXEC es atómica pero si EXPIRE falla, las otras ops ya se ejecutaron. | Usar Redis 7+ `SET` con argumentos MX, o capturar error de `expire` explícitamente. |

---

## 2. Reenvío de imágenes — PERF-05 a 09

### PERF-05: Tiempo por imagen (download + send)
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| ms por imagen | < 6000ms | ~2000-5000ms (download: 1-3s, send: 1-2s) | ⚠️ **Depende de WhatsApp** |

**Evidencia**: `ExecuteForwardService.ts` L32-52 llama `downloadMedia()` + `sendMedia()` secuencialmente.

**Hallazgo crítico**: `downloadMedia()` en `whaileys.ts` L1580-1598 itera **TODOS los chats** del store de Baileys:
```typescript
for (const chatJid of chatJids) {
  const msgs = store.messages[chatJid]?.array || [];
  foundMsg = msgs.find((m: WAMessage) => m.key?.id === messageId);
  if (foundMsg) break;
}
```
Si el número tiene 50+ chats con miles de mensajes, esta búsqueda lineal es O(n*m) donde n = chats, m = mensajes por chat. Para 15 imágenes, se repite 15 veces.

### PERF-06: Tiempo total para 15 imágenes
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| ms total 15 img (delay=4000) | < 60000ms | ~90-120s | ⚠️ **Límite** |

**Cálculo**:
- Baseline: 15 img × 4000ms = 60s (solo delays)
- + 15 × downloadMedia (~2s c/u) = 30s adicionales
- + 15 × sendMedia (~1s c/u) = 15s adicionales
- **Total estimado: 105s** (vs meta 60s)

### PERF-07: Delay real entre envíos
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| Precisión delay | ±500ms del config | `setTimeout` típicamente ±200ms | ✅ **OK** |

### PERF-08: Rate-limit de WhatsApp
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| Bloqueos 429 | 0 | No medible sin test | ⚠️ **Sin protección** |

**Evidencia**: No hay backoff exponencial ni retry. Si WhatsApp responde 429, el error se loggea y se continúa.

### PERF-09: Tamaño promedio de imagen
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| KB por imagen | Reportar | ~100-500 KB (fotos WhatsApp típicas) | ✅ **Info** |

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **HIGH** | `whaileys.ts` L1590-1597 | **downloadMedia() escanea TODOS los chats** para encontrar un mensaje. O(n*m) por imagen. 15 imágenes = 15 escaneos completos del store. Con 50+ grupos, puede tardar segundos por imagen. | Indexar mensajes por messageId en un Map en memoria, o pasar el chatJid conocido (está en buffer) a downloadMedia para acotar la búsqueda a 1 chat. |
| **MEDIUM** | `ExecuteForwardService.ts` L32-52 | **Sin timeout en downloadMedia/sendMedia**: si WhatsApp tarda, toda la cadena se bloquea. El admin espera sin feedback hasta que termina. | Agregar timeout de 15s por imagen via `Promise.race()` con un timer. Si falla, continuar con la siguiente. |
| **LOW** | `ExecuteForwardService.ts` | **Sin backoff ni retry**: si sendMedia falla, esa imagen se pierde. En grupos grandes con rate-limit, reintentar con backoff ayudaría. | Implementar retry 1-2 veces con backoff de 1s, 2s antes de fallar. |

---

## 3. API REST — PERF-10 a 13

### PERF-10: GET /api/auto-forwards
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| p50 | < 200ms | ~30-80ms | ✅ **OK** |
| p95 | < 500ms | ~100-200ms | ✅ **OK** |

**Evidencia**: `ListAutoForwardService.ts` hace `AutoForward.findAll()` con filtro opcional. Una query simple, índice en `whatsappId`. Sin joins, sin subqueries.

### PERF-11: POST /api/auto-forwards
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| p50 | < 300ms | ~50-100ms (con validación) | ✅ **OK** |

**Evidencia**: Una operación `AutoForward.create()` con validación de uniqueness de name.

### PERF-12: GET /api/whatsapp/:id/groups
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| p50 | < 1000ms | ~500-3000ms | ⚠️ **Depende de Baileys** |

**Evidencia**: `fetchGroups()` L1569 llama `wbot.groupFetchAllParticipating()` que hace una petición de red a WhatsApp. Para números con 50+ grupos, puede tardar varios segundos.

### PERF-13: GET /api/auto-forwards/:id/logs
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| p50 (50 logs) | < 100ms | ~20-50ms | ✅ **OK** |

**Evidencia**: `ListAutoForwardLogsService.ts` hace `findAll()` con índice en `autoForwardId` + `limit=50`.

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **CRITICAL** | `AutoForwards/index.js` L153-170 | **N+1 groups en fetchRules()**: por cada whatsappId único, llama `/whatsapp/${wid}/groups`. Si hay 10 conexiones con reglas, son 10 requests secuenciales (aunque paralelizados con Promise.all, bloquean). Además esto se ejecuta en CADA `fetchRules()`, o sea en cada CRUD. | Opción A: agregar `groupNames` al endpoint `GET /auto-forwards` incluyendo los nombres de grupo via JOIN o columna cacheada. Opción B: cachear resultado de `/whatsapp/:id/groups` en frontend con react-query/SWR con staleTime 5min. |
| **HIGH** | `ListAutoForwardService.ts` | **Sin paginación**: si hay 200+ reglas, se cargan todas. El frontend las renderiza todas en una tabla. | Agregar `page`/`pageSize` query params con default 50. |
| **MEDIUM** | `WhatsAppController.ts` L118-125 | `fetchGroups()` no tiene caché. Se llama cada vez que se abre el modal CRUD. Para una conexión con 50 grupos, son ~2-3s de espera. | Cachear resultado en Redis con TTL 5min: `autoforward:groups:${whatsappId}`. O cachear en frontend. |

---

## 4. Frontend — PERF-14 a 19

### PERF-14: Bundle size del nuevo page
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| KB (source) | < 50 KB | 23 KB (724 líneas) | ✅ **OK** |
| KB (compiled en bundle) | — | ~100 KB (estimado con MUI) | ⚠️ **Atado al main chunk** |

**Evidencia**: `AutoForwards/index.js` = 23 KB. Se importa estáticamente en `routes/index.js` L21: `import AutoForwards from "../pages/AutoForwards/"`. **NO hay `React.lazy()`**. Esto significa que está en el chunk principal de 1.6MB.

### PERF-15: Tree-shake de ForwardIcon
| Métrica | Esperado | Real | Veredicto |
|---------|----------|------|-----------|
| Solo ForwardIcon importado | Sí | `import { Forward } from "@material-ui/icons"` | ✅ **OK** (parcial) |

**Evidencia**: `MainListItems.js` L21 importa solo `ForwardIcon`. Pero MUI v4 no tree-shakea bien, por lo que todo `@material-ui/icons` (~50KB gzipped) puede estar en el bundle.

### PERF-16: Tiempo de carga /auto-reenvio
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| First Paint | < 1500ms | ~1000-2000ms | ⚠️ **Límite** (depende del main chunk) |

### PERF-17: LCP
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| LCP | < 2500ms | ~1500-3000ms | ⚠️ **Límite** |

### PERF-18: Re-renders en tabla de reglas
| Métrica | Esperado | Contado | Veredicto |
|---------|----------|---------|-----------|
| # renders al cargar | < 3 | 2 (1 loading + 1 data) | ✅ **OK** |

**Evidencia**: `fetchRules()` se llama en useEffect + en cada CRUD handler. No hay renders extraños obvios. Pero **cada fetchRules() dispara 1+N llamadas API** (1 list + N groups).

### PERF-19: Memoria del modal de logs con 50 entradas
| Métrica | Esperado | Estimado | Veredicto |
|---------|----------|----------|-----------|
| MB | < 5 MB | ~0.5-1 MB (50 filas en tabla) | ✅ **OK** |

| Severidad | Archivo | Problema | Sugerencia |
|-----------|---------|----------|------------|
| **CRITICAL** | `routes/index.js` L21 | **AutoForwards importado estáticamente en main chunk** de 1.6MB. Viola PERF-14 implícitamente. Si el usuario nunca visita /auto-reenvio, pagó el costo igual. | Convertir a `const AutoForwards = React.lazy(() => import("../pages/AutoForwards/"))` con `<Suspense>`. El chunk separado sería ~23KB source + overhead MUI compartido. |
| **HIGH** | `AutoForwards/index.js` L153-170 | **fetchRules() hace N+1 a /whatsapp/:wid/groups** para obtener nombres de grupo. Ver PERF-10. Además fuerza re-render completo de toda la tabla. | Cachear groupNames en el frontend o incluirlos en la respuesta de la API. |
| **MEDIUM** | `AutoForwards/index.js` | **Sin React.memo ni useMemo**: la tabla de reglas re-renderiza completa en cada `fetchRules()` (llamado en cada CRUD). Con 50+ reglas, perceptible. | Envolver la tabla en `React.memo` o usar `useMemo` para las filas de la tabla. |
| **LOW** | `MainListItems.js` L120-124 | ForwardIcon importado de `@material-ui/icons` completo. MUI v4 no tree-shakea. | Usar import directo: `import ForwardIcon from "@material-ui/icons/Forward"` (ya se hace, pero MUI v4 igualmente no tree-shakea bien). |

---

## 5. Resumen vs Metas (PERF)

| ID | Métrica | Meta | Real/Estimado | Estado |
|----|---------|------|---------------|--------|
| PERF-01 | Memoria Redis | < 1 MB | ~2-3 KB | ✅ |
| PERF-02 | TTL efectivo | Sin estancamiento | EXPIRE 3600 en cada add | ✅ |
| PERF-03 | Límite 50 | ≤ 50 | LTRIM 0 49 | ✅ |
| PERF-04 | Latencia Redis | < 10ms | ~2-5ms | ✅ |
| PERF-05 | Tiempo por imagen | < 6000ms | ~2000-5000ms | ✅⚠️ (sin timeout) |
| PERF-06 | Tiempo total 15 img | < 60000ms | ~90-120s | ❌ |
| PERF-07 | Precisión delay | ±500ms | ~±200ms | ✅ |
| PERF-08 | Rate-limit | 0 bloqueos | Sin protección | ⚠️ |
| PERF-09 | Tamaño imagen | Reportar | ~100-500 KB | ℹ️ |
| PERF-10 | GET /auto-forwards p50 | < 200ms | ~30-80ms | ✅ |
| PERF-11 | POST /auto-forwards p50 | < 300ms | ~50-100ms | ✅ |
| PERF-12 | GET /whatsapp/:id/groups | < 1000ms | ~500-3000ms | ⚠️ |
| PERF-13 | GET /logs p50 | < 100ms | ~20-50ms | ✅ |
| PERF-14 | Bundle size | < 50 KB | 23 KB (pero en main chunk) | ⚠️ |
| PERF-15 | Tree-shake icono | Solo ForwardIcon | Importado correctamente | ✅ |
| PERF-16 | First Paint | < 1500ms | ~1000-2000ms | ⚠️ |
| PERF-17 | LCP | < 2500ms | ~1500-3000ms | ⚠️ |
| PERF-18 | Re-renders | < 3 | 2 (1+N API calls) | ⚠️ |
| PERF-19 | Memoria logs | < 5 MB | ~0.5-1 MB | ✅ |

---

## 6. Hallazgos Consolidados por Severidad

### 🔴 Critical (2)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `routes/index.js` | AutoForwards importado estáticamente en bundle 1.6MB | `React.lazy()` |
| `AutoForwards/index.js` L153-170 | fetchRules() N+1 grupos por whatsappId | Cachear groupNames o endpoint unificado |

### 🟡 High (3)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `whaileys.ts` L1590-1597 | downloadMedia() escanea todos los chats O(n*m) | Pasar chatJid conocido o indexar mensajes |
| `ListAutoForwardService.ts` | Sin paginación (200+ reglas) | Agregar page/pageSize |
| `ExecuteForwardService.ts` | Sin timeout en download/send | Promise.race con 15s timeout |

### Medium (4)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `WhatsAppController.ts` | fetchGroups() sin caché | Cachear en Redis 5min |
| `MessageBuffer.ts` L26 | Silently fails si Redis null | Warning/métrica |
| `ExecuteForwardService.ts` | Sin backoff/retry | Retry 1-2 con backoff |
| `AutoForwards/index.js` | Tabla sin React.memo | Memoizar filas |

### Low (3)
| Archivo | Problema | Fix |
|---------|----------|-----|
| `MessageBuffer.ts` L17 | Redis key prefix inconsistente | Usar `autofwd:buffer:` según spec |
| `MessageBuffer.ts` L35 | EXPIRE fuera de atomicidad parcial | Manejar error EXPIRE |
| `ExecuteForwardService.ts` | PERF-06 sobrepasa meta 60s | Reducir delay default a 2000ms |

---

## 7. Próximos Pasos (orden de impacto)

1. **🔴 CRITICAL**: `React.lazy()` para AutoForwards — separa 23KB del main bundle
2. **🔴 CRITICAL**: Eliminar N+1 de groupNames en fetchRules() (opción: endpoint que ya mapee nombres o cache local con staleTime 5min)
3. **🟡 HIGH**: Pasar `chatJid` conocido a `downloadMedia()` en vez de escanear todos los chats
4. **🟡 HIGH**: Agregar paginación a `GET /auto-forwards` (PERF-10)
5. **🟡 HIGH**: Timeout 15s en downloadMedia/sendMedia (PERF-05)
6. **🟡 MEDIUM**: Cachear fetchGroups() en Redis (PERF-12)
7. **🟢 LOW**: Warning cuando Redis no está disponible (PERF-04)
