# Reenvío Automático — Bot de Reenvío de Imágenes por Comando Privado

## Especificación de Software — v1.0

---

## Guía de Handoff por Agente

| Fase | Agente | Qué construye | Depende de |
|------|--------|---------------|------------|
| **Fase 1** | `senior-node-backend` | Modelos, migraciones, servicios, controladores, rutas, integración en handler | Nada |
| **Fase 2** | `react-mui-frontend` | Página lista-reglas, modal CRUD, logs, navegación sidebar | Fase 1 (API endpoints) |
| **Fase 3** | `qa-reviewer` | Validación contra spec, pruebas funcionales | Fase 1 + 2 |
| **Fase 4** | `performance-auditor` | Auditoría de rendimiento: Web Vitals, bundle size, queries, buffer, rate-limit | Fase 1 + 2 |

**Stack**: Node.js + TypeScript + Express + Sequelize + MySQL (backend), React 16 + Material UI 4 + Vite (frontend)

---

## 1. Overview

Módulo independiente dentro de WhaTicket que permite **reenviar imágenes desde un grupo WhatsApp origen a un grupo destino**, activado mediante **comandos privados** que el administrador envía al número del bot.

El bot pertenece a ambos grupos pero **nunca escribe en ellos**. Solo reenvía. El admin controla todo desde un chat privado con el bot.

**Caso de uso**: Un administrador publica "artes" (imágenes de partidos de fútbol) en un grupo interno de emprendedores. Cuando quiere compartirlas con sus clientes, escribe al bot en privado: `/reenvio artes-diarios`. El bot escanea el grupo origen, encuentra las últimas imágenes agrupadas, lista las encontradas, pide confirmación, y las reenvía al grupo destino.

**Independencia**: Este módulo NO depende de BotRules, FlowBot, AI Agent, ni ScheduledMessages. Solo de MySQL + Baileys + node-cache.

---

## 2. User Story

```
Como administrador de un grupo de WhatsApp,
quiero enviar un comando privado al bot
para que reenvíe imágenes de un grupo origen a un grupo destino,
sin que nadie sepa que el bot está operando.
```

---

---

# ═══════════════════════════════════════════
# FASE 1: BACKEND (senior-node-backend)
# ═══════════════════════════════════════════

## 1A. Modelo de Datos — MySQL

### Tabla: `AutoForwards`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| whatsappId | INTEGER | FK → Whatsapps.id, NOT NULL, ON DELETE CASCADE | Conexión WhatsApp |
| name | VARCHAR(100) | NOT NULL, UNIQUE | Slug de la regla (ej. "artes-diarios") |
| sourceGroupJid | VARCHAR(255) | NOT NULL | JID del grupo origen |
| targetGroupJid | VARCHAR(255) | NOT NULL | JID del grupo destino |
| adminNumbers | TEXT | NOT NULL | Números autorizados (1 por línea, solo dígitos) |
| timeWindowMinutes | INTEGER | NOT NULL, DEFAULT 10 | Ventana de clustering temporal |
| maxLookback | INTEGER | NOT NULL, DEFAULT 50 | Máx mensajes a escanear hacia atrás |
| maxForward | INTEGER | NOT NULL, DEFAULT 15 | Máx imágenes a reenviar por comando |
| customCaption | TEXT | NULL | Texto opcional que acompaña las imágenes |
| delayBetweenMs | INTEGER | NOT NULL, DEFAULT 4000 | Pausa entre reenvíos (ms) |
| enabled | BOOLEAN | NOT NULL, DEFAULT true | |
| createdAt | DATETIME | NOT NULL | |
| updatedAt | DATETIME | NOT NULL | |

**Índices**: UNIQUE(name), INDEX(whatsappId)

### Tabla: `AutoForwardLogs`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| autoForwardId | INTEGER | FK → AutoForwards.id, ON DELETE CASCADE | |
| adminNumber | VARCHAR(20) | NOT NULL | Quién ejecutó |
| imageCount | INTEGER | NOT NULL | Cuántas imágenes |
| status | ENUM('success','no_images','cancelled','error') | NOT NULL | |
| errorMessage | TEXT | NULL | |
| executedAt | DATETIME | NOT NULL, DEFAULT NOW() | |

**Índices**: INDEX(autoForwardId), INDEX(executedAt)

### Tabla: `AutoForwardSessions` (opcional, solo si se necesita persistir estado de confirmación)

No necesaria. Se usa node-cache en memoria para el estado de confirmación:

```typescript
// En node-cache, TTL = 120 segundos
interface ConfirmationState {
  adminNumber: string;
  ruleId: number;
  images: ScannedImage[];
}
interface ScannedImage {
  id: string;
  filename: string;
  mimetype: string;
  data: string;        // base64
  timestamp: number;
  caption?: string;
}
```

---

## 1B. Modelos Sequelize

Crear archivos siguiendo el patrón existente del proyecto:

### `backend/src/models/AutoForward.ts`
- Decoradores: `@Table`, `@Column`, `@ForeignKey`, `@BelongsTo`, `@Default`, `@AllowNull`, `@PrimaryKey`, `@AutoIncrement`, `@CreatedAt`, `@UpdatedAt`
- Relación: `@BelongsTo(() => Whatsapp)`
- Importar desde `sequelize-typescript`

### `backend/src/models/AutoForwardLog.ts`
- Mismos decoradores
- Relación: `@BelongsTo(() => AutoForward)`
- Campo `status` como ENUM o VARCHAR con validación

---

## 1C. Migraciones Sequelize

Usar nombres con timestamp como los existentes en `backend/src/database/migrations/`:

```
20260522000001-create-auto-forwards.ts
20260522000002-create-auto-forward-logs.ts
```

Seguir el patrón exacto de migraciones existentes:
```typescript
import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutoForwards", { ... });
  },
  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("AutoForwards");
  }
};
```

Incluir Foreign Keys con `references: { model: "Whatsapps", key: "id" }`, `onUpdate: "CASCADE"`, `onDelete: "CASCADE"`.

---

## 1D. Servicios Backend

Todos en `backend/src/services/AutoForwardServices/`. Cada servicio es una función exportada por defecto (seguir el patrón del proyecto).

### 1D.1: CRUD Básico

| Servicio | Método | Descripción |
|----------|--------|-------------|
| `ListAutoForwardService.ts` | `async (whatsappId?: number) => AutoForward[]` | Listar reglas, opcional filtro por conexión. Ordenar por createdAt DESC. |
| `CreateAutoForwardService.ts` | `async (data: CreateAutoForwardData) => AutoForward` | Validar uniqueness de name, crear regla |
| `UpdateAutoForwardService.ts` | `async (id: number, data: Partial<AutoForwardData>) => AutoForward` | Actualizar campos |
| `DeleteAutoForwardService.ts` | `async (id: number) => void` | Eliminar regla + logs en cascada |
| `ToggleAutoForwardService.ts` | `async (id: number) => AutoForward` | Cambiar enabled a !enabled |

`CreateAutoForwardData`:
```typescript
interface CreateAutoForwardData {
  whatsappId: number;
  name: string;
  sourceGroupJid: string;
  targetGroupJid: string;
  adminNumbers: string;
  timeWindowMinutes?: number;
  maxLookback?: number;
  maxForward?: number;
  customCaption?: string;
  delayBetweenMs?: number;
  enabled?: boolean;
}
```

### 1D.2: Message Buffer (node-cache)

Archivo: `MessageBuffer.ts`

```typescript
// API pública
class MessageBuffer {
  static add(whatsappId: number, groupJid: string, message: BufferMessage): void;
  static getMessages(whatsappId: number, groupJid: string): BufferMessage[];
  static clear(whatsappId: number, groupJid: string): void;
}

interface BufferMessage {
  id: string;
  timestamp: number;
  type: string;        // "image" | "video" | "chat" | etc
  hasMedia: boolean;
  mediaPayload?: {     // undefined si no tiene media
    filename: string;
    mimetype: string;
    data: string;      // base64
  };
  body?: string;       // caption si es imagen
}
```

Implementación:
- Usar `NodeCache` con `stdTTL: 3600` (1 hora)
- Clave: `${whatsappId}:${groupJid}`
- Valor: array de hasta 50 `BufferMessage`
- Al agregar mensaje nuevo, si excede 50, eliminar el más antiguo (shift)

### 1D.3: Clustering Temporal

Archivo: `ScanGroupImagesService.ts`

```typescript
async function scanGroupImages(
  rule: AutoForward
): Promise<ScannedImage[]>
```

Algoritmo:
```
1. Obtener bufferMessages = MessageBuffer.getMessages(rule.whatsappId, rule.sourceGroupJid)
2. Si bufferMessages.length === 0 → retornar []
3. Filtrar solo mensajes con type === "image" y hasMedia === true
4. Ordenar por timestamp DESC (más reciente primero)
5. Si no hay imágenes → retornar []
6. Primer cluster = [imágenes[0]]
7. Para cada imagen[i] desde i=1:
   gap = (timestamp[0] - timestamp[i]) / 60000  // en minutos
   Si gap <= rule.timeWindowMinutes → agregar a cluster
   Si gap > rule.timeWindowMinutes → break (cluster cerrado)
8. Si cluster.length === 0 → retornar []
9. Limitar a rule.maxForward
10. Retornar cluster
```

### 1D.4: Comandos Privados

Archivo: `HandlePrivateCommand.ts`

```typescript
async function handlePrivateCommand(
  whatsappId: number,
  fromNumber: string,    // JID del contacto (ej. "59170000000@c.us")
  messageBody: string    // texto del mensaje
): Promise<void>
```

Flujo:
```
1. Si messageBody === "/help" → enviar /help response, retornar
2. Si messageBody === "/list" → enviar /list response, retornar
3. Si messageBody.startsWith("/reenvio "):
   a. Extraer ruleName (lo que sigue a "/reenvio ")
   b. Buscar regla con name = ruleName Y enabled = true Y whatsappId = whatsappId
   c. Si no existe → enviar: "❌ Regla no encontrada. Usa /list para ver disponibles."
   d. Normalizar fromNumber a solo dígitos (ej. "59170000000")
   e. Verificar fromNumber en adminNumbers de la regla
   f. Si no autorizado → enviar: "❌ No tienes permiso para ejecutar esta regla."
   g. Llamar scanGroupImages(rule)
   h. Si 0 imágenes → enviar: "No se encontraron imágenes recientes en [sourceGroup]."
      → Crear log con status: 'no_images'
   i. Si N imágenes → enviar lista:
        "🔍 Buscando en \"[grupo origen]\"...\n\nSe encontraron {N} imágenes:\n🖼️ 1. [filename] — [hora]\n🖼️ 2. [filename] — [hora]\n...\n\n¿Reenviar estas {N} imágenes a \"[grupo destino]\"?\nEscribe \"si\" para confirmar, o cualquier otra cosa para cancelar."
      → Guardar ConfirmationState en node-cache (TTL 120s)
      → Retornar (esperar respuesta del admin)
4. Si messageBody.startsWith("/") pero no coincide → enviar /help response
5. Si NO empieza con "/" → ignorar (no es comando)
```

Para el paso 3.i, cuando el admin responde, el handler debe detectar que hay un `ConfirmationState` activo:

```
En handlePrivateCommand:
1. Buscar ConfirmationState en cache
2. Si existe:
   a. Si messageBody === "si" → llamar ExecuteForwardService, responder resultado
   b. Si messageBody !== "si" → eliminar state, responder "Reenvío cancelado."
   c. Crear log con status correspondiente
3. Si no existe → procesar como comando nuevo (paso 1-5 arriba)
```

### 1D.5: Ejecución de Reenvío

Archivo: `ExecuteForwardService.ts`

```typescript
async function executeForward(
  rule: AutoForward,
  images: ScannedImage[],
  adminNumber: string
): Promise<{ success: boolean; count: number; totalTimeMs: number }>
```

Flujo:
```
1. Para cada imagen en images, CON índice:
   a. Construir mediaInput: { data: Buffer.from(imagen.data, 'base64'), mimetype, filename }
   b. Construir options: { caption: rule.customCaption (solo si es la primera imagen y customCaption no es null) }
   c. Llamar: whatsappProvider.sendMedia(rule.whatsappId, rule.targetGroupJid, mediaInput, options)
   d. Si hay más imágenes → await delay(rule.delayBetweenMs)
   e. Manejar errores: si falla una, continuar con las demás
2. Al terminar:
   a. Crear AutoForwardLog con status 'success', imageCount = images.length
   b. Responder al admin: "✅ ¡Listo! {N} imágenes reenviadas a \"[grupo destino]\". ⏱️ Tiempo total: {X} segundos."
3. Si todas fallan → log con status 'error', responder: "❌ Error al reenviar imágenes. {detalle}"
```

### 1D.6: Logs

Archivo: `ListAutoForwardLogsService.ts`

```typescript
async function listLogs(autoForwardId: number, limit?: number): Promise<AutoForwardLog[]>
```

- Ordenar por executedAt DESC
- Default limit = 50

---

## 1E. Controladores

Archivo: `backend/src/controllers/AutoForwardController.ts`

Seguir el patrón de `BotRuleController.ts`:

| Método | Endpoint | Función |
|--------|----------|---------|
| `index` | GET | Listar reglas |
| `store` | POST | Crear regla |
| `update` | PUT /:id | Actualizar regla |
| `remove` | DELETE /:id | Eliminar regla |
| `toggle` | PUT /:id/toggle | Activar/desactivar |
| `logs` | GET /:id/logs | Obtener logs |

Cada controlador:
- Recibe `Request, Response` de Express
- Llama al servicio correspondiente
- Retorna `res.json()` o `res.status(201).json()` o `res.status(204).json()`

---

## 1F. Rutas

Archivo: `backend/src/routes/autoForwardRoutes.ts`

```typescript
import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as AutoForwardController from "../controllers/AutoForwardController";

const autoForwardRoutes = Router();

autoForwardRoutes.get("/auto-forwards", isAuth, AutoForwardController.index);
autoForwardRoutes.post("/auto-forwards", isAuth, AutoForwardController.store);
autoForwardRoutes.put("/auto-forwards/:id", isAuth, AutoForwardController.update);
autoForwardRoutes.delete("/auto-forwards/:id", isAuth, AutoForwardController.remove);
autoForwardRoutes.put("/auto-forwards/:id/toggle", isAuth, AutoForwardController.toggle);
autoForwardRoutes.get("/auto-forwards/:id/logs", isAuth, AutoForwardController.logs);

export default autoForwardRoutes;
```

Registrar en `backend/src/routes/index.ts`:
```typescript
import autoForwardRoutes from "./autoForwardRoutes";
// dentro del router principal:
router.use(autoForwardRoutes);
```

---

## 1G. Endpoint Utilitario: Listar Grupos

Agregar en `backend/src/controllers/WhatsAppController.ts` (o controlador existente de WhatsApp):

```
GET /api/whatsapp/:id/groups → Listar grupos del número
```

Endpoint que retorna `{ jid, subject, participants }` para cada grupo donde está el número.

Implementación (en whaileys provider):
```typescript
const groups = await wbot.groupFetchAllParticipatingGroups();
const result = Object.entries(groups).map(([jid, metadata]) => ({
  jid,
  subject: metadata.subject,
  participantCount: metadata.participants?.length || 0
}));
return res.json(result);
```

Protegido con middleware `isAuth`.

---

## 1H. Integración en handleWhatsappEvents.ts

En `backend/src/handlers/handleWhatsappEvents.ts`, después de la línea donde se procesa el mensaje normal (~línea 296), agregar:

```typescript
// ===== Reenvío Automático =====
import { handlePrivateCommand } from "../services/AutoForwardServices/HandlePrivateCommand";
import { MessageBuffer } from "../services/AutoForwardServices/MessageBuffer";

// 1. Almacenar mensajes de grupos en buffer (para escaneo futuro)
if (contactPayload.isGroup && !processedMessage.fromMe) {
  MessageBuffer.add(contextPayload.whatsappId, contactPayload.number, {
    id: processedMessage.id,
    timestamp: processedMessage.timestamp,
    type: processedMessage.type,
    hasMedia: processedMessage.hasMedia,
    mediaPayload: mediaPayload ? { 
      filename: mediaPayload.filename, 
      mimetype: mediaPayload.mimetype, 
      data: mediaPayload.data 
    } : undefined,
    body: processedMessage.body
  });
}

// 2. Detectar y procesar comandos privados (solo en chat individual, no grupos)
if (!processedMessage.fromMe && !contactPayload.isGroup && 
    processedMessage.body.trim().startsWith("/")) {
  await handlePrivateCommand(
    contextPayload.whatsappId,
    contactPayload.number,
    processedMessage.body.trim()
  ).catch(err => {
    logger.error({ info: "AutoForward - Private command error", error: err.message });
  });
}
```

**Regla de oro**: Esto se ejecuta DESPUÉS del flujo normal de WhaTicket (creación de ticket, etc.), no lo interfiere.

---

---

# ═══════════════════════════════════════════
# FASE 2: FRONTEND (react-mui-frontend)
# ═══════════════════════════════════════════

## 2A. Ruta y Navegación

### Nuevo ítem en menú lateral

Editar: `frontend/src/layout/MainListItems.js`

Agregar import:
```javascript
import ForwardIcon from "@material-ui/icons/Forward";
```

Agregar ListItemLink después de "Bot Rules" (~línea 119):
```jsx
<ListItemLink
  to="/auto-reenvio"
  primary="Reenvío Automático"
  icon={<ForwardIcon />}
/>
```

### Nueva ruta

Editar: `frontend/src/routes/index.js`

Agregar import:
```javascript
import AutoForwards from "../pages/AutoForwards/";
```

Agregar Route dentro del `<Switch>` (después de bot-rules):
```jsx
<Route exact path="/auto-reenvio" component={AutoForwards} isPrivate />
```

---

## 2B. Página Principal

Archivo: `frontend/src/pages/AutoForwards/index.js`

Seguir el patrón exacto de `frontend/src/pages/BotRules/index.js`.

### Layout
- `MainContainer` como wrapper
- `MainHeader` con título "🔁 Reenvío Automático" y botón "+ Nueva Regla"
- `Paper` con `Table`

### Tabla de Reglas (FR-08.1)

Columnas:
| Columna | Contenido |
|---------|-----------|
| Nombre | `rule.name` |
| Conexión | Nombre de la conexión WhatsApp (obtener del contexto `WhatsAppsContext`) |
| Grupo Origen | Mostrar nombre del grupo (o JID si no se tiene nombre) |
| Grupo Destino | Mostrar nombre del grupo (o JID si no se tiene nombre) |
| Modo | Siempre "⚡ Bajo Demanda" (por ahora solo este modo) |
| Admins | Mostrar primeros 2 números + "..." si hay más |
| Estado | Toggle Switch (verde/rojo) |
| Acciones | IconButton: ✏️ editar, 📋 logs, 🗑️ eliminar |

### Estados de UI
- **Loading**: Mostrar `TableRowSkeleton` mientras carga
- **Empty**: "No hay reglas de reenvío. Crea una para empezar."
- **Error**: Toast con mensaje de error

---

## 2C. Modal CRUD (FR-08.2)

Seguir el patrón de `BotRules/index.js` (Dialog + DialogTitle + DialogContent + DialogActions).

### Campos del formulario

| Campo | Tipo | Valores |
|-------|------|---------|
| Nombre | TextField | Texto, requerido. Slug: solo letras, números y guiones |
| Conexión WhatsApp | Select (FormControl) | Dropdown con `whatsApps` del contexto |
| Grupo Origen | Select | Dropdown dinámico (ver 2E), requerido |
| Grupo Destino | Select | Dropdown dinámico (ver 2E), requerido |
| Números Autorizados | TextField multiline | Un número por línea, solo dígitos |
| Ventana de Tiempo (min) | TextField (number) | Default 10 |
| Máx. Imágenes a Reenviar | TextField (number) | Default 15 |
| Mensaje Opcional | TextField multiline | Caption opcional para las imágenes |
| Delay entre envíos (ms) | TextField (number) | Default 4000 |
| Activo | Switch | Default true |

### Validaciones
- `name`: requerido, solo `[a-zA-Z0-9\-]`, único
- `whatsappId`: requerido
- `sourceGroupJid`: requerido
- `targetGroupJid`: requerido, no puede ser igual a sourceGroupJid
- `adminNumbers`: requerido, al menos un número
- Mostrar errores con `toast.warn()` igual que BotRules

---

## 2D. Modal de Logs (FR-08.4)

Botón "📋 Logs" en cada fila de la tabla abre un Dialog con:

```jsx
<Dialog open={logsOpen} onClose={() => setLogsOpen(false)} maxWidth="md">
  <DialogTitle>📋 Historial - {rule.name}</DialogTitle>
  <DialogContent>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Fecha</TableCell>
          <TableCell>Admin</TableCell>
          <TableCell>Imágenes</TableCell>
          <TableCell>Estado</TableCell>
          <TableCell>Error</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {logs.map(log => (
          <TableRow key={log.id}>
            <TableCell>{format(log.executedAt, 'dd/MM/yyyy HH:mm')}</TableCell>
            <TableCell>{log.adminNumber}</TableCell>
            <TableCell>{log.imageCount}</TableCell>
            <TableCell>
              <Chip 
                label={statusLabel(log.status)} 
                color={statusColor(log.status)} 
                size="small" 
              />
            </TableCell>
            <TableCell>{log.errorMessage || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setLogsOpen(false)} color="primary">Cerrar</Button>
  </DialogActions>
</Dialog>
```

Cargar logs via: `GET /api/auto-forwards/${rule.id}/logs`

---

## 2E. Selector de Grupos (FR-08.3)

Los selects de "Grupo Origen" y "Grupo Destino" deben ser dropdowns que se cargan dinámicamente.

```
Cuando el usuario selecciona una Conexión WhatsApp:
→ GET /api/whatsapp/${whatsappId}/groups
→ Poblar los dropdowns de grupos con { subject, jid }
→ Mostrar "Cargando grupos..." mientras se resuelve
→ En el dropdown mostrar: subject (jid)
```

Si la API de grupos falla o no hay grupos, mostrar TextField manual para pegar JID.

---

## 2F. Confirmación de Eliminación

Seguir el patrón de `ConfirmationModal` en BotRules:
```jsx
<ConfirmationModal
  title={`Eliminar "${deleting?.name}"?`}
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  onConfirm={handleDelete}
>
  Esta acción eliminará la regla y su historial de reenvíos.
</ConfirmationModal>
```

---

---

# ═══════════════════════════════════════════
# FASE 3: QA (qa-reviewer)
# ═══════════════════════════════════════════

## 3A. Criterios de Validación

| # | Escenario | Pasos | Resultado Esperado |
|---|-----------|-------|-------------------|
| QA1 | Crear regla | 1. Ir a Reenvío Automático > "+ Nueva Regla"<br>2. name: "artes-diarios"<br>3. Conexión: seleccionar<br>4. Grupo Origen y Destino: seleccionar<br>5. Admin: 59170000000<br>6. Guardar | Regla creada, visible en tabla con estado 🟢 |
| QA2 | Validación nombre duplicado | 1. Crear regla "artes-diarios"<br>2. Crear otra con mismo nombre | Error toast: nombre ya existe |
| QA3 | Grupos iguales | 1. Crear regla con mismo grupo origen y destino | Error toast: deben ser diferentes |
| QA4 | Ejecutar comando exitoso | 1. Enviar 3 imágenes al grupo origen<br>2. Admin escribe al bot: `/reenvio artes-diarios`<br>3. Bot lista 3 imágenes<br>4. Admin: "si"<br>5. Imágenes aparecen en grupo destino | Reenvío completo |
| QA5 | Sin imágenes | 1. Admin escribe: `/reenvio artes-diarios`<br>2. No hay imágenes en buffer | Bot: "No se encontraron imágenes" |
| QA6 | No autorizado | 1. Número NO en adminNumbers escribe: `/reenvio artes-diarios` | Bot: "No tienes permiso" |
| QA7 | Regla no existe | 1. Admin escribe: `/reenvio no-existe` | Bot: "Regla no encontrada" |
| QA8 | Comando inválido | 1. Admin escribe: `/xyz` | Bot responde con `/help` |
| QA9 | Confirmación cancelada | 1. `/reenvio artes-diarios` → bot lista<br>2. Admin: "no" | Bot: "Reenvío cancelado." |
| QA10 | Timeout confirmación | 1. `/reenvio artes-diarios` → bot lista<br>2. Esperar 3 minutos<br>3. Admin: "si" | Bot: "Solicitud expirada" |
| QA11 | Clustering temporal | 1. Imágenes en grupo: [08:00, 08:03, 08:07, 08:30, 08:32]<br>2. Ventana=10min<br>3. Ejecutar /reenvio a 08:33 | Solo detecta [08:30, 08:32] |
| QA12 | Límite maxForward | 1. 20 imágenes en cluster<br>2. maxForward=15 | Solo reenvía 15 |
| QA13 | Logs visibles | 1. Ejecutar varios reenvíos<br>2. Ir a UI > 📋 Logs de la regla | Entradas visibles con fecha, admin, #, estado |
| QA14 | Eliminar regla | 1. Eliminar regla con logs<br>2. Verificar: regla + logs borrados | Borrado en cascada |
| QA15 | Toggle activar/desactivar | 1. Desactivar regla (toggle OFF)<br>2. Ejecutar /reenvio | Bot: "Regla no encontrada" |
| QA16 | Menú lateral | 1. Verificar que "Reenvío Automático" aparece en sidebar | Visible después de "Bot Rules" |
| QA17 | Ruta protegida | 1. Cerrar sesión<br>2. Navegar a /auto-reenvio | Redirige a login |

---

## 3B. Pruebas de Integración

| # | Escenario | Detalle |
|---|-----------|---------|
| PI-1 | Buffer no satura | Enviar 100 mensajes a un grupo, verificar buffer solo guarda 50 |
| PI-2 | Comando no interfiere | Enviar mensaje normal (sin /) en privado, verificar que NO se procesa como comando |
| PI-3 | Grupo no interfiere | Enviar "/reenvio" dentro de un grupo, verificar que NO se procesa (solo privado) |
| PI-4 | Delay entre reenvíos | Enviar 5 imágenes, verificar timestamps tienen ~4s de diferencia |
| PI-5 | Tiempo total < 1 min | 15 imágenes × 4s = 60s. Verificar que completa en ≤ 60s |

---

---

# ═══════════════════════════════════════════
# ANEXOS
# ═══════════════════════════════════════════

## A. Diagrama de Flujo Completo

```
Admin → Chat privado con bot: "/reenvio artes-diarios"
  │
  ▼
handlePrivateCommand()
  │
  ├─ ¿Es "/help"?         → Enviar ayuda
  ├─ ¿Es "/list"?         → Enviar lista reglas donde admin está autorizado
  ├─ ¿Empieza con "/reenvio "?
  │     │
  │     ▼
  │   Parsear ruleName
  │   Buscar regla por name + enabled + whatsappId
  │     │
  │     ├─ ¿No existe?    → "❌ Regla no encontrada"
  │     ├─ ¿No autorizado?→ "❌ No tienes permiso"
  │     └─ ✅ Autorizado
  │           │
  │           ▼
  │     ScanGroupImagesService()
  │       Leer buffer node-cache
  │       Filtrar imágenes
  │       Clustering temporal
  │         │
  │         ├─ 0 imágenes → "No se encontraron imágenes" + log(no_images)
  │         └─ N imágenes → Listar + guardar ConfirmationState (TTL 120s)
  │                           │
  │                           ▼
  │                  Esperar respuesta del admin
  │                    │              │
  │                  "si"         cualquier otra
  │                    │              │
  │                    ▼              ▼
  │            ExecuteForward()   "Reenvío cancelado."
  │            ┌──────────────┐   log(cancelled)
  │            │ Por cada img  │
  │            │ sendMedia()   │
  │            │ delay(4s)     │
  │            └──────────────┘
  │            log(success)
  │            "✅ Listo! N imágenes..."
  │
  ├─ ¿Empieza con "/"? (no coincide) → Enviar /help
  └─ No empieza con "/" → Ignorar
```

## B. Comandos del Bot (v1)

| Comando | Respuesta |
|---------|-----------|
| `/reenvio <nombre>` | Busca imágenes, lista, pide confirmación, reenvía |
| `/help` | Muestra lista de comandos disponibles |
| `/list` | Muestra reglas accesibles para el admin |

## C. Suposiciones (Assumptions)

| ID | Descripción |
|----|-------------|
| A-01 | El número del bot es miembro de ambos grupos (origen y destino) |
| A-02 | node-cache ya está disponible como dependencia (`node-cache` en package.json) |
| A-03 | El store de Baileys contiene los mensajes recientes del grupo |
| A-04 | Los JIDs de grupo tienen formato `{numero}-{sufijo}@g.us` |
| A-05 | Los números se normalizan a solo dígitos (sin `+`, `591`, `@c.us`) para comparación |
| A-06 | El middleware `isAuth` y el sistema de autenticación existen |
| A-07 | `sendMedia()` acepta Buffer base64 (ya probado en BotRules y AI Agent) |
| A-08 | `whatsappProvider.sendMessage()` existe para respuestas de texto al admin |

## D. Comandos Futuros (v2+)

| Comando | Descripción |
|---------|-------------|
| `/status` | Estado del bot (conectado/sesiones activas) |
| `/stats <name>` | Estadísticas de una regla |
| `/cancel` | Cancela operación actual |
| `/broadcast <texto>` | Envía mensaje a un grupo |

---

# ═══════════════════════════════════════════
# FASE 4: PERFORMANCE (performance-auditor)
# ═══════════════════════════════════════════

## 4A. Alcance de la Auditoría

El `performance-auditor` debe analizar **4 áreas críticas** del módulo Reenvío Automático:

| Área | Qué auditar | Riesgo si falla |
|------|-------------|-----------------|
| **Buffer en memoria** | node-cache: tamaño, TTL, fugas | OOM si crece sin control |
| **Reenvío de imágenes** | sendMedia + delay: throughput, rate-limit de WhatsApp | Bloqueo temporal del número |
| **API endpoints** | Tiempo de respuesta CRUD + consulta grupos | UX lento |
| **Frontend bundle** | Peso del nuevo page/chunk | Carga inicial lenta |

---

## 4B. Puntos de Auditoría Específicos

### 4B.1: Buffer node-cache

| ID | Verificación | Métrica | Meta |
|----|-------------|---------|------|
| PERF-01 | Consumo de memoria del buffer | MB usados | < 10 MB con 50 mensajes/grupo × 10 grupos |
| PERF-02 | TTL efectivo | ¿Expiran mensajes > 1h? | Sin estancamiento |
| PERF-03 | Límite de 50 mensajes | ¿Se respeta el shift? | Nunca excede 50 |
| PERF-04 | Clave única por grupo | ¿Colisiones de clave? | 0 colisiones |

**Herramienta sugerida**: `process.memoryUsage()` + log cada 100 operaciones de buffer.

### 4B.2: Reenvío de imágenes

| ID | Verificación | Métrica | Meta |
|----|-------------|---------|------|
| PERF-05 | Tiempo por imagen (sendMedia) | ms por imagen | < 3000ms |
| PERF-06 | Tiempo total N imágenes | ms total | < 60000ms (N=15, delay=4000) |
| PERF-07 | Delay real entre envíos | ms real vs configurado | ±500ms del config |
| PERF-08 | Rate-limit de WhatsApp | ¿Bloqueos 429? | 0 bloqueos |
| PERF-09 | Tamaño promedio de imagen | KB | Reportar distribución |

### 4B.3: API REST

| ID | Verificación | Métrica | Meta |
|----|-------------|---------|------|
| PERF-10 | GET /api/auto-forwards | ms (p50, p95, p99) | p50 < 200ms, p95 < 500ms |
| PERF-11 | POST /api/auto-forwards | ms | p50 < 300ms |
| PERF-12 | GET /api/whatsapp/:id/groups | ms | p50 < 1000ms (depende de Baileys) |
| PERF-13 | GET /api/auto-forwards/:id/logs | ms (50 logs) | p50 < 100ms |

### 4B.4: Frontend

| ID | Verificación | Métrica | Meta |
|----|-------------|---------|------|
| PERF-14 | Bundle size del nuevo chunk | KB sin comprimir | < 50 KB |
| PERF-15 | Tree-shake: ¿importa solo ForwardIcon? | KB vs @material-ui/icons completo | Solo el icono necesario |
| PERF-16 | Tiempo de carga de página /auto-reenvio | ms (First Paint) | < 1500ms |
| PERF-17 | LCP (Largest Contentful Paint) | ms | < 2500ms |
| PERF-18 | Cantidad de re-renders en tabla de reglas | # renders | < 3 al cargar |
| PERF-19 | Memoria del modal de logs con 50 entradas | MB | < 5 MB |

---

## 4C. Reporte de Performance

El `performance-auditor` debe generar un archivo `handoff/perf-report-reenvio.md` con:

```markdown
# Reporte de Performance — Reenvío Automático

## Resumen
- 🟢 Todo OK / 🟡 Advertencias / 🔴 Crítico

## Resultados por área
| Área | Estado | Hallazgos |
|------|--------|-----------|
| Buffer node-cache | 🟢 | ... |
| Reenvío de imágenes | 🟡 | ... |
| API endpoints | 🟢 | ... |
| Frontend bundle | 🟢 | ... |

## Recomendaciones
1. ...
2. ...
```

Cada hallazgo debe incluir:
- **Problema**: descripción clara
- **Métrica obtenida**: valor actual
- **Meta**: valor esperado
- **Sugerencia**: qué cambiar

---

## 4D. Pruebas de Carga (Opcional)

Si hay tiempo, simular:

| Escenario | Cómo | Métrica |
|-----------|------|---------|
| 10 admins ejecutan /reenvio simultáneo | 10 requests en paralelo | ¿Colisión de buffer? ¿Rate-limit? |
| 50 imágenes en grupo (buffer lleno) | Enviar 50 imágenes en 5 min | Buffer respeta límite |
| Reenvío de 15 imágenes con delay 0 | Forzar sin delay | ¿WhatsApp bloquea? |

---

*Documento generado el 2026-05-22. Reenvío Automático v1.0 — WhaTicket Community Edition.*
