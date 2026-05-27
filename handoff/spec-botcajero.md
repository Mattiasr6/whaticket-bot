# BotCajero — Bot Moderador de Grupo + Asistente de Admin por Comandos Privados

## Especificación de Software — v1.0

---

## Guía de Handoff por Agente

| Fase | Agente | Qué construye | Depende de |
|------|--------|---------------|------------|
| **Fase 1** | `senior-node-backend` | Modelos, migraciones, servicios, controladores, rutas, handlers de eventos, integración | Nada |
| **Fase 2** | `react-mui-frontend` | Página de configuración del BotCajero para el admin | Fase 1 (API endpoints) |
| **Fase 3** | `qa-reviewer` | Validación contra spec, pruebas funcionales | Fase 1 + 2 |
| **Fase 4** | `performance-auditor` | Auditoría de rendimiento: concurrencia, rate-limit, memoria | Fase 1 + 2 |

**Stack**: Node.js + TypeScript + Express + Sequelize + MySQL + Redis (backend), React 16 + Material UI 4 + Vite (frontend)

---

## 1. Overview

Módulo independiente dentro de WhaTicket que convierte un número de WhatsApp en un **bot cajero** para grupos de apuestas deportivas. El bot **modera el grupo automáticamente** (bienvenidas, despedidas, FAQs, anti-spam, horarios) y **asiste al admin en privado** mediante comandos (promos, stickers, configuraciones).

El bot es miembro del grupo. Nunca habla a menos que el evento lo requiera (bienvenida, FAQ match, etc.). Responde al admin solo en chat 1:1.

**Caso de uso**: Un cajero de apuestas tiene un grupo de WhatsApp con 100+ clientes. El bot da la bienvenida automática con reglas, responde "¿cuándo pagan?" y "¿hay carga?" sin que el cajero toque el teléfono. De noche (11pm-8am) se silencia. Si pasan 24h sin mensajes, el bot manda un rompehielo. El admin puede enviar promos al grupo desde privado con `/promo`, convertir imágenes a stickers con `/sticker`, y activar/desactivar funciones con comandos.

**Independencia**: Este módulo NO depende de FlowBot, Reenvío Automático, BotRules, AI Agent, ni ScheduledMessages. Solo de MySQL + Redis + Baileys.

---

## 2. User Story

```
Como administrador de un grupo de WhatsApp de apuestas,
quiero que un bot modere el grupo automáticamente
y me asista desde el chat privado con comandos,
para no tener que estar pendiente 24/7 del grupo.
```

**Criterios de aceptación**:

- [UA1] El bot da la bienvenida con sticker + reglas en privado cuando alguien entra al grupo
- [UA2] El bot se despide automáticamente cuando alguien se va
- [UA3] El bot responde FAQs cuando detecta palabras clave (depósito, retiro, horario, etc.)
- [UA4] El bot elimina links de competidores y advierte en privado
- [UA5] El bot advierte públicamente por palabrotas
- [UA6] Entre 11pm y 8am el bot no responde automáticamente
- [UA7] Si el grupo está >24h sin mensajes, el bot envía un rompehielo
- [UA8] El admin puede enviar `/promo <texto>` desde privado y aparece en el grupo
- [UA9] El admin puede convertir imagen a sticker con `/sticker`
- [UA10] El admin puede activar/desactivar funciones con `/atencion on|off` y `/bienvenida on|off`
- [UA11] El admin puede obtener las reglas del grupo con `/reglas`

---

---

# ═══════════════════════════════════════════
# FASE 1: BACKEND (senior-node-backend)
# ═══════════════════════════════════════════

## 1A. Modelo de Datos — MySQL

### Tabla: `BotCajeroConfig`

Configuración general del bot por conexión WhatsApp. Una fila por conexión (relación 1:1).

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| whatsappId | INTEGER | FK → Whatsapps.id, NOT NULL, UNIQUE, ON DELETE CASCADE | Conexión WhatsApp |
| groupJid | VARCHAR(255) | NOT NULL | JID del grupo a moderar |
| groupName | VARCHAR(255) | NULL | Nombre legible del grupo (caché) |
| adminNumber | VARCHAR(20) | NOT NULL | Número del admin (solo dígitos) |
| welcomeEnabled | BOOLEAN | NOT NULL, DEFAULT true | Bienvenidas automáticas |
| farewellEnabled | BOOLEAN | NOT NULL, DEFAULT true | Despedidas automáticas |
| autoReplyEnabled | BOOLEAN | NOT NULL, DEFAULT true | Respuestas automáticas FAQs |
| antiSpamEnabled | BOOLEAN | NOT NULL, DEFAULT true | Anti-spam |
| quietModeEnabled | BOOLEAN | NOT NULL, DEFAULT false | Modo silencio manual |
| quietModeStart | VARCHAR(5) | NOT NULL, DEFAULT '23:00' | Inicio modo silencio (HH:mm) |
| quietModeEnd | VARCHAR(5) | NOT NULL, DEFAULT '08:00' | Fin modo silencio (HH:mm) |
| inactivityHours | INTEGER | NOT NULL, DEFAULT 24 | Horas sin mensajes para rompehielo |
| welcomeMessage | TEXT | NULL | Mensaje de bienvenida personalizable (soporta `{{name}}`) |
| farewellMessage | TEXT | NULL | Mensaje de despedida personalizable (soporta `{{name}}`) |
| rules | TEXT | NULL | Reglas del grupo (texto multilínea) |
| createdAt | DATETIME | NOT NULL | |
| updatedAt | DATETIME | NOT NULL | |

**Índices**: UNIQUE(whatsappId), INDEX(groupJid)

### Tabla: `BotCajeroFAQs`

Respuestas automáticas configurables. Muchas FAQs por cada BotCajeroConfig.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, NOT NULL, ON DELETE CASCADE | Config padre |
| keywords | TEXT | NOT NULL | Palabras clave (1 por línea, contiene/contiene) |
| response | TEXT | NOT NULL | Texto de respuesta |
| matchType | ENUM('contains','exact','all') | NOT NULL, DEFAULT 'contains' | Tipo de matching |
| enabled | BOOLEAN | NOT NULL, DEFAULT true | |
| priority | INTEGER | NOT NULL, DEFAULT 0 | Orden de evaluación |
| createdAt | DATETIME | NOT NULL | |
| updatedAt | DATETIME | NOT NULL | |

**Índices**: INDEX(botCajeroConfigId), INDEX(enabled, priority)

### Tabla: `BotCajeroSpamRules`

Reglas de anti-spam configurables.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, NOT NULL, ON DELETE CASCADE | Config padre |
| type | ENUM('link_block','profanity') | NOT NULL | Tipo de regla |
| pattern | VARCHAR(500) | NOT NULL | Patrón (dominio bloqueado o palabra) |
| action | ENUM('delete_silent','delete_warn_private','warn_public','warn_private') | NOT NULL | Acción al detectar |
| enabled | BOOLEAN | NOT NULL, DEFAULT true | |
| createdAt | DATETIME | NOT NULL | |
| updatedAt | DATETIME | NOT NULL | |

### Tabla: `BotCajeroStickers`

Pool de stickers para bienvenidas automáticas.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, NOT NULL, ON DELETE CASCADE | Config padre |
| mediaPath | VARCHAR(500) | NOT NULL | Ruta al archivo sticker (.webp) |
| mediaName | VARCHAR(255) | NULL | Nombre descriptivo |
| createdAt | DATETIME | NOT NULL | |

### Tabla: `BotCajeroLogs`

Bitácora de acciones del bot.

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, NOT NULL, ON DELETE CASCADE | |
| eventType | VARCHAR(50) | NOT NULL | Tipo: 'welcome','farewell','faq','spam','promo','sticker','inactivity_reminder','quiet_mode' |
| detail | TEXT | NULL | Descripción del evento |
| createdAt | DATETIME | NOT NULL, DEFAULT NOW() | |

**Índices**: INDEX(botCajeroConfigId, eventType), INDEX(createdAt)

### Estado en Redis (no MySQL)

El bot usa Redis para:

```typescript
// Clave: "botcajero:lastmsg:{whatsappId}:{groupJid}"
// Valor: timestamp UNIX del último mensaje en el grupo
// TTL: nunca expira (se actualiza en cada mensaje)
// Propósito: detectar inactividad > 24h

// Clave: "botcajero:lasticebreaker:{whatsappId}:{groupJid}"  
// Valor: timestamp UNIX del último rompehielo enviado
// TTL: nunca expira
// Propósito: evitar enviar múltiples rompehielos
```

---

## 1B. Modelos Sequelize

Crear siguiendo el patrón del proyecto:

- `backend/src/models/BotCajeroConfig.ts` — Relación `@BelongsTo(() => Whatsapp)`
- `backend/src/models/BotCajeroFAQ.ts` — Relación `@BelongsTo(() => BotCajeroConfig)`
- `backend/src/models/BotCajeroSpamRule.ts` — Relación `@BelongsTo(() => BotCajeroConfig)`
- `backend/src/models/BotCajeroSticker.ts` — Relación `@BelongsTo(() => BotCajeroConfig)`
- `backend/src/models/BotCajeroLog.ts` — Relación `@BelongsTo(() => BotCajeroConfig)`

Todas con decoradores `@Table`, `@Column`, `@ForeignKey`, `@BelongsTo`, `@Default`, `@AllowNull`, `@PrimaryKey`, `@AutoIncrement`, `@CreatedAt`, `@UpdatedAt`.

---

## 1C. Migraciones Sequelize

```
20260525000001-create-botcajero-configs.ts
20260525000002-create-botcajero-faqs.ts
20260525000003-create-botcajero-spam-rules.ts
20260525000004-create-botcajero-stickers.ts
20260525000005-create-botcajero-logs.ts
```

Seguir el patrón de migraciones existentes con Foreign Keys y Cascade.

---

## 1D. Servicios Backend

Todos en `backend/src/services/BotCajeroServices/`.

### 1D.1: CRUD Básico

| Servicio | Descripción |
|----------|-------------|
| `GetConfigService.ts` | Obtener/crear config por whatsappId (upsert). Retorna `BotCajeroConfig` con FAQs, SpamRules, Stickers incluidos |
| `UpdateConfigService.ts` | Actualizar campos de config (groupJid, adminNumber, messages, toggles, horarios) |
| `DeleteConfigService.ts` | Eliminar config + todo lo relacionado (cascada) |
| `CreateFAQService.ts` | Agregar FAQ a una config |
| `UpdateFAQService.ts` | Editar FAQ |
| `DeleteFAQService.ts` | Eliminar FAQ |
| `CreateSpamRuleService.ts` | Agregar regla anti-spam |
| `DeleteSpamRuleService.ts` | Eliminar regla anti-spam |
| `AddStickerService.ts` | Agregar sticker al pool |
| `DeleteStickerService.ts` | Eliminar sticker del pool |
| `ListLogsService.ts` | Listar logs por config, opcional filtro por eventType |

### 1D.2: Group Participant Events (Baileys hook)

Archivo: `GroupParticipantHandler.ts`

```typescript
async function handleGroupParticipantUpdate(
  whatsappId: number,
  groupJid: string,
  participants: string[],
  action: "add" | "remove"
): Promise<void>
```

**Flujo de bienvenida (action = "add"):**
```
1. Buscar BotCajeroConfig activa para whatsappId + groupJid
2. Si no existe o welcomeEnabled = false → salir
3. Para cada participant en participants:
   a. Obtener nombre del participante (del contacto o "Usuario")
   b. Enviar mensaje de bienvenida al GRUPO:
      "🎉 ¡Bienvenido {{name}} al grupo {{groupName}}!\n\nLee las reglas en tu privado 📩"
   c. Seleccionar sticker aleatorio del pool → enviar sticker al grupo
   d. Si rules no está vacío → enviar reglas en PRIVADO al participante:
      "📜 Reglas de {{groupName}}:\n\n{{rules}}"
   e. Crear BotCajeroLog con eventType: 'welcome'
```

**Flujo de despedida (action = "remove"):**
```
1. Buscar BotCajeroConfig activa para whatsappId + groupJid
2. Si no existe o farewellEnabled = false → salir
3. Para cada participant en participants:
   a. Enviar al grupo: "👋 {{name}} salió del grupo."
   b. Crear BotCajeroLog con eventType: 'farewell'
```

### 1D.3: FAQ Auto-Reply

Archivo: `FAQAutoReply.ts`

```typescript
async function handleFAQAutoReply(
  whatsappId: number,
  groupJid: string,
  messageBody: string
): Promise<boolean>  // true si respondió
```

**Flujo:**
```
1. Verificar si está en horario de silencio (quietMode): 
   horaActual entre quietModeStart y quietModeEnd → salir (retornar false)
2. Verificar autoReplyEnabled = true → si no, salir
3. Cargar FAQs activas ordenadas por priority ASC
4. Para cada FAQ:
   a. Evaluar keywords con matchType contra messageBody (mismo algoritmo que BotRules)
   b. Si matchea → enviar response al grupo
      → Crear BotCajeroLog con eventType: 'faq'
      → Retornar true
5. Retornar false (nadie respondió)
```

**Algoritmo de matching** (reutilizar lógica de `EvaluateBotRules.ts`):
- `contains`: body contiene alguna keyword
- `exact`: body es exactamente igual a alguna keyword
- `all`: body contiene TODAS las keywords

### 1D.4: Anti-Spam

Archivo: `AntiSpamService.ts`

```typescript
async function handleAntiSpam(
  whatsappId: number,
  groupJid: string,
  messageBody: string,
  messageId: string,       // para eliminar el mensaje
  senderJid: string,       // para enviar warn privado
  senderName: string
): Promise<boolean>  // true si detectó algo
```

**Flujo:**
```
1. Si antiSpamEnabled = false → retornar false
2. Cargar SpamRules activas para esta config
3. Para cada regla:
   a. Buscar pattern en messageBody (case-insensitive)
   b. Si match:
      - link_block + delete_silent:
        → Eliminar mensaje del grupo (deleteMessage)
        → Enviar warn PRIVADO al sender:
           "⚠️ Tu mensaje fue eliminado. No compartas enlaces de otros sitios."
        → Crear BotCajeroLog con eventType: 'spam'
        → Retornar true
      - link_block + delete_warn_private:
        → Eliminar mensaje
        → Enviar warn privado
        → Retornar true
      - profanity + warn_public:
        → Enviar al GRUPO (sin eliminar):
           "⚠️ @sender, por favor mantén un lenguaje respetuoso en el grupo."
        → Crear BotCajeroLog
        → Retornar true
      - profanity + warn_private:
        → Enviar warn PRIVADO al sender
        → Retornar true
4. Retornar false
```

**Eliminación de mensajes en Baileys:**
```typescript
await wbot.sendMessage(groupJid, { delete: { remoteJid: groupJid, id: messageId, fromMe: false, participant: senderJid } });
```

### 1D.5: Inactivity Reminder

Archivo: `InactivityReminderService.ts`

```typescript
async function checkInactivity(whatsappId: number, groupJid: string): Promise<void>
```

**Ejecución**: Se llama desde un intervalo/setInterval cada 30 minutos (no por mensaje entrante). O desde un cron job liviano.

**Flujo:**
```
1. Obtener config para whatsappId + groupJid
2. Si autoReplyEnabled = false → salir
3. Leer de Redis: "botcajero:lastmsg:{whatsappId}:{groupJid}"
4. Si no existe → salir (no hay datos todavía)
5. Leer de Redis: "botcajero:lasticebreaker:{whatsappId}:{groupJid}"
6. Calcular horasDesdeUltimoMsg = (ahora - lastMsgTimestamp) / 3600000
7. Calcular horasDesdeIcebreaker = (ahora - lastIcebreaker) / 3600000
8. Si horasDesdeUltimoMsg >= inactivityHours (24h) 
   Y (no hay icebreaker previo O horasDesdeIcebreaker >= inactivityHours):
   a. Enviar rompehielo al grupo (mensaje aleatorio de un pool)
   b. Guardar timestamp en "botcajero:lasticebreaker:{whatsappId}:{groupJid}"
   c. Crear BotCajeroLog con eventType: 'inactivity_reminder'
```

**Mensajes rompehielo (pool fijo en código, configurable en el futuro):**
```typescript
const ICEBREAKERS = [
  "🤔 ¿Alguien tiene dudas sobre las apuestas de hoy?",
  "⚡ Recuerden que pueden consultar horarios y cuotas con solo preguntar.",
  "💬 ¿Todo bien por aquí? Si necesitan algo, pregunten sin miedo.",
  "📢 Recuerden las reglas del grupo: respeto ante todo.",
  "🎯 No olviden que tenemos promociones especiales. Pregunten por privado."
];
```

### 1D.6: Comandos Privados

Archivo: `HandlePrivateCommand.ts`

```typescript
async function handlePrivateCommand(
  whatsappId: number,
  fromNumber: string,    // JID del admin (ej. "59170000000@c.us")
  messageBody: string,   // texto del mensaje
  mediaPayload?: MediaPayload  // si el mensaje tiene imagen (para /sticker)
): Promise<void>
```

**Flujo general:**

```
1. Normalizar fromNumber a solo dígitos
2. Buscar BotCajeroConfig para this whatsappId
3. Verificar fromNumber === config.adminNumber
4. Si no es admin → ignorar comando (no responder)
5. Parsear comando y ejecutar según tabla:
```

| Comando | Parseo | Acción |
|---------|--------|--------|
| `/promo <texto>` | Extraer texto después de "/promo " | Enviar texto al `groupJid`: "📢 PROMO DEL DÍA:\n\n{texto}" |
| `/sticker` | Verificar que el mensaje tiene media (imagen) | Descargar imagen, enviar al admin como sticker via sendMessage con `{ sticker: Buffer }` |
| `/atencion on` | - | `autoReplyEnabled = true`. Responder: "✅ Respuestas automáticas activadas." |
| `/atencion off` | - | `autoReplyEnabled = false`. Responder: "⛔ Respuestas automáticas desactivadas." |
| `/bienvenida on` | - | `welcomeEnabled = true`. Responder: "✅ Bienvenidas activadas." |
| `/bienvenida off` | - | `welcomeEnabled = false`. Responder: "⛔ Bienvenidas desactivadas." |
| `/reglas` | - | Enviar `config.rules` al admin. Si está vacío: "📜 No hay reglas configuradas todavía." |
| `/help` | - | Enviar lista de comandos disponibles |

**Detalle de `/promo`:**
```typescript
// Validar que texto no esté vacío
// Enviar al grupo:
await whatsappProvider.sendMessage(whatsappId, config.groupJid, 
  `📢 PROMO DEL DÍA:\n\n${promoText}`);
// Responder al admin:
await whatsappProvider.sendMessage(whatsappId, fromNumber,
  `✅ Promo enviada al grupo "${config.groupName || config.groupJid}".`);
// Crear BotCajeroLog con eventType: 'promo'
```

**Detalle de `/sticker`:**
```typescript
// Verificar mediaPayload existe y es imagen
if (!mediaPayload || !mediaPayload.mimetype.startsWith("image/")) {
  await respond(whatsappId, fromNumber, 
    "❌ Responde a una imagen con /sticker para crearla.");
  return;
}
// Descargar buffer
const buffer = Buffer.from(mediaPayload.data, 'base64');
// Enviar como sticker usando Baileys sendMessage con { sticker: buffer }
await wbot.sendMessage(normalizeJid(fromNumber), { 
  sticker: buffer,
  mimetype: mediaPayload.mimetype 
});
// Crear BotCajeroLog con eventType: 'sticker'
```

### 1D.7: Quiet Mode Check

Archivo: `QuietModeService.ts`

```typescript
function isInQuietMode(config: BotCajeroConfig): boolean
```

```typescript
// Extraer hora actual (HH:mm)
// Comparar si está dentro del rango quietModeStart a quietModeEnd
// Manejar el caso donde quietModeStart > quietModeEnd (pasa la medianoche):
//   ej: start=23:00, end=08:00 → está en silencio entre 23:00-23:59 y 00:00-08:00
```

---

## 1E. Integración en whaileys.ts (Provider)

### 1E.1: Listener de Group Participant Events

En la función `init()` de `backend/src/providers/WhatsApp/Implementations/whaileys.ts`, después del listener de `messages.upsert` (~línea 1058), agregar:

```typescript
import { handleGroupParticipantUpdate } from "../../../services/BotCajeroServices/GroupParticipantHandler";

wbot.ev.on("group-participants.update", async (update: { jid: string; participants: string[]; actor: string; action: "add" | "remove" }) => {
  try {
    // Solo procesar si el grupo es el configurado para BotCajero
    await handleGroupParticipantUpdate(sessionId, update.jid, update.participants, update.action);
  } catch (err) {
    logger.error({ info: "BotCajero - Group participant error", error: (err as Error).message });
  }
});
```

### 1E.2: Sticker support en sendMessage

Para el comando `/sticker`, `sendMessage` debe soportar el tipo `sticker`. Ya existe en la whaileys implementación la lógica para stickers en recepción. Para envío, usar directamente:

```typescript
const wbot = getWbot(sessionId);
await wbot.sendMessage(normalizeJid(to), { sticker: mediaBuffer });
```

---

## 1F. Integración en handleWhatsappEvents.ts

Después del bloque de Reenvío Automático (~línea 355), agregar:

```typescript
// ===== BotCajero =====
import { handlePrivateCommand } from "../services/BotCajeroServices/HandlePrivateCommand";
import { handleFAQAutoReply } from "../services/BotCajeroServices/FAQAutoReply";
import { handleAntiSpam } from "../services/BotCajeroServices/AntiSpamService";
import { setInRedis, getRedisClient } from "../libs/redisStore";

// 1. Actualizar timestamp del último mensaje en el grupo (para inactividad)
if (contactPayload.isGroup && !processedMessage.fromMe) {
  const redis = getRedisClient();
  if (redis) {
    const lastMsgKey = `botcajero:lastmsg:${contextPayload.whatsappId}:${contactPayload.number}`;
    await redis.set(lastMsgKey, Date.now().toString());
  }
}

// 2. Anti-spam (solo en el grupo, mensajes entrantes)
if (contactPayload.isGroup && !processedMessage.fromMe && processedMessage.body) {
  const spamDetected = await handleAntiSpam(
    contextPayload.whatsappId,
    contactPayload.number,
    processedMessage.body,
    processedMessage.id,
    contactPayload.number,
    contactPayload.name
  );
  // Si se detectó spam y se eliminó el mensaje, NO continuar con FAQ
  if (spamDetected) return;
}

// 3. FAQ auto-reply (solo en el grupo, mensajes entrantes)
if (contactPayload.isGroup && !processedMessage.fromMe && processedMessage.body) {
  await handleFAQAutoReply(
    contextPayload.whatsappId,
    contactPayload.number,
    processedMessage.body
  );
}

// 4. Comandos privados del admin (solo chat individual, no grupos)
if (!processedMessage.fromMe && !contactPayload.isGroup && 
    processedMessage.body.trim().startsWith("/")) {
  await handlePrivateCommand(
    contextPayload.whatsappId,
    contactPayload.number,
    processedMessage.body.trim(),
    mediaPayload
  );
}
```

### 1F.1: Inactivity Reminder (setInterval global)

En `backend/src/server.ts` o un servicio inicializado al arrancar:

```typescript
// Cada 30 minutos, revisar inactividad en todos los BotCajeroConfig activos
setInterval(async () => {
  const configs = await BotCajeroConfig.findAll({ where: { autoReplyEnabled: true } });
  for (const config of configs) {
    try {
      await checkInactivity(config.whatsappId, config.groupJid);
    } catch (err) {
      logger.error({ info: "BotCajero - Inactivity check error", error: (err as Error).message });
    }
  }
}, 30 * 60 * 1000); // 30 minutos
```

---

## 1G. Controladores

Archivo: `backend/src/controllers/BotCajeroController.ts`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `index` | GET /api/bot-cajero/:whatsappId | Obtener config completa + FAQs + SpamRules + Stickers |
| `update` | PUT /api/bot-cajero/:whatsappId | Actualizar config |
| `delete` | DELETE /api/bot-cajero/:whatsappId | Eliminar config |
| `storeFAQ` | POST /api/bot-cajero/:whatsappId/faqs | Crear FAQ |
| `updateFAQ` | PUT /api/bot-cajero/:whatsappId/faqs/:id | Editar FAQ |
| `deleteFAQ` | DELETE /api/bot-cajero/:whatsappId/faqs/:id | Eliminar FAQ |
| `storeSpamRule` | POST /api/bot-cajero/:whatsappId/spam-rules | Crear regla anti-spam |
| `deleteSpamRule` | DELETE /api/bot-cajero/:whatsappId/spam-rules/:id | Eliminar regla |
| `addSticker` | POST /api/bot-cajero/:whatsappId/stickers | Agregar sticker al pool |
| `deleteSticker` | DELETE /api/bot-cajero/:whatsappId/stickers/:id | Eliminar sticker |
| `logs` | GET /api/bot-cajero/:whatsappId/logs | Obtener logs (opcional filtro eventType) |

---

## 1H. Rutas

Archivo: `backend/src/routes/botCajeroRoutes.ts`

```typescript
import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as BotCajeroController from "../controllers/BotCajeroController";

const botCajeroRoutes = Router();

botCajeroRoutes.get("/bot-cajero/:whatsappId", isAuth, BotCajeroController.index);
botCajeroRoutes.put("/bot-cajero/:whatsappId", isAuth, BotCajeroController.update);
botCajeroRoutes.delete("/bot-cajero/:whatsappId", isAuth, BotCajeroController.delete);

botCajeroRoutes.post("/bot-cajero/:whatsappId/faqs", isAuth, BotCajeroController.storeFAQ);
botCajeroRoutes.put("/bot-cajero/:whatsappId/faqs/:id", isAuth, BotCajeroController.updateFAQ);
botCajeroRoutes.delete("/bot-cajero/:whatsappId/faqs/:id", isAuth, BotCajeroController.deleteFAQ);

botCajeroRoutes.post("/bot-cajero/:whatsappId/spam-rules", isAuth, BotCajeroController.storeSpamRule);
botCajeroRoutes.delete("/bot-cajero/:whatsappId/spam-rules/:id", isAuth, BotCajeroController.deleteSpamRule);

botCajeroRoutes.post("/bot-cajero/:whatsappId/stickers", isAuth, BotCajeroController.addSticker);
botCajeroRoutes.delete("/bot-cajero/:whatsappId/stickers/:id", isAuth, BotCajeroController.deleteSticker);

botCajeroRoutes.get("/bot-cajero/:whatsappId/logs", isAuth, BotCajeroController.logs);

export default botCajeroRoutes;
```

---

---

# ═══════════════════════════════════════════
# FASE 2: FRONTEND (react-mui-frontend)
# ═══════════════════════════════════════════

## 2A. Ruta y Navegación

Editar `frontend/src/layout/MainListItems.js`:

```javascript
import CasinoOutlinedIcon from "@material-ui/icons/CasinoOutlined";

// Agregar después de "Cron Jobs" (~línea 123):
<ListItemLink
  to="/bot-cajero"
  primary="Bot Cajero"
  icon={<CasinoOutlinedIcon />}
/>
```

Editar `frontend/src/routes/index.js`:
```javascript
import BotCajero from "../pages/BotCajero/";

<Route exact path="/bot-cajero" component={BotCajero} isPrivate />
```

## 2B. Página Principal

Archivo: `frontend/src/pages/BotCajero/index.js`

Layout con **tabs** (Material UI `<Tabs>`):

| Tab | Contenido |
|-----|-----------|
| ⚙️ Configuración | Formulario general (grupo, admin, mensajes, horarios, toggles) |
| ❓ FAQs | Tabla de FAQs + modal crear/editar |
| 🛡️ Anti-Spam | Tabla de reglas + modal crear |
| 🎨 Stickers | Grid de stickers + upload |
| 📋 Logs | Tabla de eventos del bot |

### Tab: Configuración

Campos del formulario:
- **Conexión WhatsApp** — Select con `whatsApps` del contexto
- **Grupo a moderar** — Dropdown con grupos disponibles (mismo endpoint que Reenvío Automático: `GET /api/whatsapp/:id/groups`)
- **Número del admin** — TextField (solo dígitos)
- **Mensaje de bienvenida** — TextField multiline, placeholder: "🎉 ¡Bienvenido {{name}}!"
- **Mensaje de despedida** — TextField multiline, placeholder: "👋 {{name}} salió del grupo."
- **Reglas del grupo** — TextField multiline (para el comando `/reglas`)
- **Toggles**: Bienvenida, Despedida, Auto-Reply, Anti-Spam — Switches
- **Horario silencio** — Desde: TimePicker, Hasta: TimePicker
- **Horas inactividad** — Number (default 24)

### Tab: FAQs

Tabla con columnas: Keywords, Respuesta, Match Type, Prioridad, Activo, Acciones (editar, eliminar).

Modal crear/editar FAQ:
- Keywords — TextField multiline (1 por línea)
- Respuesta — TextField multiline
- Match Type — Select (contains, exact, all)
- Prioridad — Number
- Activo — Switch

### Tab: Anti-Spam

Tabla con columnas: Tipo, Patrón, Acción, Activo, Acciones (eliminar).

Modal crear regla:
- Tipo — Select (link_block, profanity)
- Patrón — TextField (dominio o palabra)
- Acción — Select (delete_silent, delete_warn_private, warn_public, warn_private)
- Activo — Switch

### Tab: Stickers

Grid de thumbnails de stickers. Botón "Agregar Sticker" para subir archivo .webp.

### Tab: Logs

Tabla con columnas: Fecha, Evento, Detalle. Filtro por tipo de evento.

---

---

# ═══════════════════════════════════════════
# FASE 3: QA (qa-reviewer)
# ═══════════════════════════════════════════

## 3A. Criterios de Validación

| # | Escenario | Pasos | Resultado Esperado |
|---|-----------|-------|-------------------|
| QA1 | Configurar bot | 1. Ir a BotCajero > Config<br>2. Seleccionar conexión, grupo, admin<br>3. Guardar | Config creada |
| QA2 | Bienvenida automática | 1. Alguien entra al grupo<br>2. Bot envía bienvenida al grupo + sticker<br>3. Bot envía reglas en privado al nuevo miembro | Bienvenida completa |
| QA3 | Despedida automática | 1. Alguien sale del grupo | Bot: "👋 name salió del grupo." |
| QA4 | FAQ match | 1. Alguien escribe "depósito" en grupo<br>2. FAQ configurada con keyword "depósito" | Bot responde con la FAQ |
| QA5 | FAQ sin match | 1. Alguien escribe "hola" en grupo<br>2. No hay FAQ para "hola" | Bot no responde |
| QA6 | Anti-spam link | 1. Alguien envía link a competidor<br>2. Regla: delete_silent | Mensaje eliminado, warn privado |
| QA7 | Anti-spam profanity | 1. Alguien dice palabra prohibida<br>2. Regla: warn_public | Bot advierte en grupo |
| QA8 | Modo silencio | 1. Configurar silencio 23:00-08:00<br>2. A las 23:30 alguien escribe "depósito" | Bot no responde |
| QA9 | Inactividad | 1. Grupo sin mensajes > 24h<br>2. Bot envía rompehielo | Mensaje rompehielo en grupo |
| QA10 | /promo | 1. Admin escribe en privado: `/promo 30% off hoy` | Promo aparece en grupo |
| QA11 | /sticker | 1. Admin envía imagen con caption `/sticker` | Admin recibe sticker |
| QA12 | /atencion off | 1. Admin escribe: `/atencion off`<br>2. Alguien escribe "depósito" | Bot no responde |
| QA13 | /reglas | 1. Admin escribe: `/reglas` | Admin recibe reglas configuradas |
| QA14 | No-admin ignorado | 1. Número NO admin escribe: `/promo test` | Bot no responde |

## 3B. Pruebas de Integración

| # | Escenario | Detalle |
|---|-----------|---------|
| PI-1 | Bienvenida concurrente | 3 personas entran al grupo simultáneamente → 3 bienvenidas |
| PI-2 | FAQ + Anti-spam orden | Mensaje con link de competidor Y palabra "depósito" → anti-spam gana (mensaje eliminado, FAQ no se ejecuta) |
| PI-3 | Sticker de imagen grande | Imagen 10MB → se convierte a sticker |
| PI-4 | Rompehielo no duplica | Pasar 48h sin mensajes → solo 1 rompehielo (no 2) |
| PI-5 | Persistencia Redis | Reiniciar servidor → timestamps de inactividad se pierden (Redis volatile). Al recibir nuevo mensaje se re-inicia el contador. |

---

---

# ═══════════════════════════════════════════
# ANEXOS
# ═══════════════════════════════════════════

## A. Tabla de Eventos Automáticos

| Evento | Trigger | Acción del Bot | Dónde responde | Configurable |
|--------|---------|---------------|----------------|--------------|
| **Bienvenida** | `group-participants.update` + action: "add" | Mensaje personalizado + sticker aleatorio + reglas en privado | Grupo + Privado al nuevo | welcomeEnabled, welcomeMessage, Stickers pool |
| **Despedida** | `group-participants.update` + action: "remove" | Mensaje de despedida | Grupo | farewellEnabled, farewellMessage |
| **FAQ** | Mensaje en grupo matchea keywords | Responde con texto preconfigurado | Grupo | autoReplyEnabled, FAQs |
| **Anti-spam links** | Mensaje contiene dominio bloqueado | Elimina + warn privado | Privado al sender | antiSpamEnabled, SpamRules |
| **Anti-spam profanity** | Mensaje contiene palabra prohibida | Warn público | Grupo | antiSpamEnabled, SpamRules |
| **Modo silencio** | Hora actual entre quietModeStart y quietModeEnd | Suprime todas las respuestas automáticas | — (se silencia) | quietModeStart, quietModeEnd |
| **Rompehielo** | Grupo sin mensajes > inactivityHours | Envía mensaje aleatorio | Grupo | inactivityHours, autoReplyEnabled |

## B. Tabla de Comandos Privados

| Comando | Argumento | Quién | Respuesta del Bot |
|---------|-----------|-------|-------------------|
| `/promo <texto>` | Texto de la promo | Admin | Envía texto al grupo: "📢 PROMO DEL DÍA:\n\n{texto}" |
| `/sticker` | (responde a imagen) | Admin | Convierte imagen a sticker y lo envía al admin |
| `/atencion on` | — | Admin | Activa autoReplyEnabled. Responde: "✅ Respuestas activadas." |
| `/atencion off` | — | Admin | Desactiva autoReplyEnabled. Responde: "⛔ Respuestas desactivadas." |
| `/bienvenida on` | — | Admin | Activa welcomeEnabled. Responde: "✅ Bienvenidas activadas." |
| `/bienvenida off` | — | Admin | Desactiva welcomeEnabled. Responde: "⛔ Bienvenidas desactivadas." |
| `/reglas` | — | Admin | Envía rules al admin. Si vacío: "📜 No hay reglas configuradas." |
| `/help` | — | Admin | Lista todos los comandos disponibles |

## C. Estructura de Archivos

```
backend/src/
├── controllers/
│   └── BotCajeroController.ts
├── models/
│   ├── BotCajeroConfig.ts
│   ├── BotCajeroFAQ.ts
│   ├── BotCajeroSpamRule.ts
│   ├── BotCajeroSticker.ts
│   └── BotCajeroLog.ts
├── services/
│   └── BotCajeroServices/
│       ├── GetConfigService.ts
│       ├── UpdateConfigService.ts
│       ├── DeleteConfigService.ts
│       ├── CreateFAQService.ts
│       ├── UpdateFAQService.ts
│       ├── DeleteFAQService.ts
│       ├── CreateSpamRuleService.ts
│       ├── DeleteSpamRuleService.ts
│       ├── AddStickerService.ts
│       ├── DeleteStickerService.ts
│       ├── ListLogsService.ts
│       ├── GroupParticipantHandler.ts   ← eventos add/remove
│       ├── FAQAutoReply.ts              ← matching de FAQs
│       ├── AntiSpamService.ts           ← detección + acción
│       ├── HandlePrivateCommand.ts      ← router de comandos
│       ├── QuietModeService.ts          ← chequear horario
│       └── InactivityReminderService.ts ← rompehielo
├── routes/
│   └── botCajeroRoutes.ts
└── database/migrations/
    ├── 20260525000001-create-botcajero-configs.ts
    ├── 20260525000002-create-botcajero-faqs.ts
    ├── 20260525000003-create-botcajero-spam-rules.ts
    ├── 20260525000004-create-botcajero-stickers.ts
    └── 20260525000005-create-botcajero-logs.ts

frontend/src/
├── pages/
│   └── BotCajero/
│       └── index.js                    ← tabs: Config, FAQs, Spam, Stickers, Logs
└── routes/index.js
```

## D. Suposiciones (Assumptions)

| ID | Descripción |
|----|-------------|
| A-01 | El número del bot es miembro del grupo a moderar |
| A-02 | Baileys (`whaileys`) emite el evento `group-participants.update` con `action: "add"` y `action: "remove"` |
| A-03 | Baileys permite eliminar mensajes de otros en el grupo con `sendMessage(jid, { delete: key })` — el bot necesita ser admin del grupo |
| A-04 | Para convertir imagen a sticker, Baileys acepta `{ sticker: Buffer }` con mimetype image |
| A-05 | Redis está configurado en `backend/src/libs/redisStore.ts` con `getRedisClient()` accesible |
| A-06 | El store de Baileys (`store.messages[groupJid]`) contiene los mensajes del grupo para el buffer |
| A-07 | Los números se normalizan a solo dígitos para comparación |
| A-08 | El middleware `isAuth` existe para proteger rutas API |
| A-09 | El bot necesita permisos de admin en el grupo para eliminar mensajes de otros miembros |

## E. Comandos Futuros (v2+)

| Comando | Descripción |
|---------|-------------|
| `/mute <jid>` | Silencia a un usuario específico (no puede escribir por N horas) |
| `/ban <jid>` | Expulsa a un usuario del grupo |
| `/warn <jid>` | Envía advertencia pública a un usuario |
| `/stats` | Estadísticas del grupo: mensajes/hoy, miembros nuevos, top preguntas |
| `/encuesta <pregunta> \| op1 \| op2` | Crea encuesta en el grupo |

---

*Documento generado el 2026-05-25. BotCajero v1.0 — WhaTicket Community Edition.*
