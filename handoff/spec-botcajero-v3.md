# BotCajero v3 — 9 Nuevas Funcionalidades

## Especificación de Software

> **Basado en**: `handoff/spec-botcajero.md` (v1 implementado), `handoff/spec-botcajero-v2.md` (v2 implementado)
> **Estado actual**: BotCajero v1+v2 completamente implementado, pipeline en Fase 4 (perf) completada.
> **Stack**: Node.js + TypeScript + Express + Sequelize + MySQL + Redis + Baileys + React 16 + MUI 4

---

## Tabla de Contenido

### GRUPO A — Alto valor, bajo esfuerzo
1. [/stats — Estadísticas del grupo](#1-stats)
2. [/sorteo — Sorteo aleatorio](#2-sorteo)
3. [/encuesta — Encuesta en grupo](#3-encuesta)

### GRUPO B — Alto valor, esfuerzo medio
4. [/recordar — Recordatorios programados](#4-recordar)
5. [Alertas al admin](#5-alertas)
6. [/mute — Silenciar usuario](#6-mute)

### GRUPO C — Medio valor, bajo esfuerzo
7. [/horario on/off — Toggle horarios](#7-horario-toggle)
8. [/warn — Advertencia pública](#8-warn)
9. [/export — Exportar config como JSON](#9-export)

---

## Resumen de esfuerzo

| # | Feature | Archivos nuevos | Archivos modificados | Esfuerzo | Grupo |
|:-:|---------|:---------------:|:--------------------:|:--------:|:-----:|
| 1 | /stats | 0 | 1 | 🟢 Bajo | A |
| 2 | /sorteo | 0 | 1 | 🟢 Bajo | A |
| 3 | /encuesta | 0 | 1 | 🟢 Bajo | A |
| 4 | /recordar | 1 | 2 | 🟡 Medio | B |
| 5 | Alertas admin | 1 | 3 | 🟡 Medio | B |
| 6 | /mute | 0 | 2 | 🟡 Medio | B |
| 7 | /horario on/off | 0 | 4 | 🟢 Bajo | C |
| 8 | /warn | 0 | 1 | 🟢 Bajo | C |
| 9 | /export | 0 | 1 | 🟢 Bajo | C |

---

<a name="1-stats"></a>
## 1️⃣ /stats — Estadísticas del Grupo

### User Story

```
Como administrador,
quiero escribir /stats en el chat privado del bot
para obtener un resumen rápido de la actividad del grupo
sin tener que revisar manualmente.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/stats` en el switch/router de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/stats"
2. HandlePrivateCommand detecta comando "/stats":
   a. Obtener wbot de la sesión: getWbot(whatsappId)
   b. OBTENER total miembros del grupo:
      const metadata = await wbot.groupMetadata(config.groupJid)
      const totalMembers = metadata.participants.length
   c. OBTENER mensajes hoy:
      Buscar en tabla Messages:
      SELECT COUNT(*) FROM Messages
      WHERE createdAt >= HOY 00:00
        AND ticketId IN (SELECT id FROM Tickets WHERE whatsappId = ?)
      → Si la tabla Messages no tiene relación directa con groupJid,
        contar desde BotCajeroLog como fallback:
        "No disponible" (primera versión)
      → Alternativa más simple: contar BotCajeroLog WHERE
        eventType IN ('faq','spam','welcome','group_command')
        AND createdAt >= HOY 00:00
   d. OBTENER top 5 FAQs más usadas:
      SELECT detail, COUNT(*) as count FROM BotCajeroLogs
      WHERE eventType = 'faq'
        AND botCajeroConfigId = config.id
      GROUP BY detail ORDER BY count DESC LIMIT 5
   e. OBTENER nuevos miembros esta semana:
      SELECT COUNT(*) FROM BotCajeroLogs
      WHERE eventType = 'welcome'
        AND botCajeroConfigId = config.id
        AND createdAt >= (NOW() - INTERVAL 7 DAY)
   f. OBTENER último mensaje (desde Redis):
      Redis.GET("botcajero:lastmsg:{whatsappId}:{groupJid}")
      → Calcular hace cuánto tiempo (min/horas/días)
   g. Formatear respuesta al ADMIN:
      "📊 ESTADÍSTICAS DEL GRUPO
      
      👥 Miembros: {totalMembers}
      📝 Mensajes hoy: {messagesToday}
      🆕 Nuevos esta semana: {newMembersWeek}
      ⏰ Último mensaje: {lastMessageAgo}
      
      🔝 FAQs más usadas:
      {#1} {count1}x — {detail1}
      {#2} {count2}x — {detail2}
      ...
      
      🛡️ Spam bloqueado hoy: {spamToday}"
   h. Crear BotCajeroLog con eventType: 'stats'
```

**Manejo de errores:**
- Si `groupMetadata` falla → "❌ No se pudo obtener metadata del grupo."
- Si Redis no tiene lastmsg → "⏰ Último mensaje: No disponible"
- Si no hay logs → mostrar 0 en cada contador

### Queries SQL Detalladas

```sql
-- Mensajes hoy (desde Messages vía tickets)
SELECT COUNT(*) as total FROM Messages m
JOIN Tickets t ON t.id = m.ticketId
WHERE t.whatsappId = :whatsappId
  AND m.createdAt >= CURDATE()
  AND m.fromMe = 0;

-- Spam bloqueado hoy
SELECT COUNT(*) FROM BotCajeroLogs
WHERE botCajeroConfigId = :configId
  AND eventType = 'spam'
  AND createdAt >= CURDATE();

-- FAQs más usadas
SELECT detail, COUNT(*) as count FROM BotCajeroLogs
WHERE botCajeroConfigId = :configId
  AND eventType = 'faq'
GROUP BY detail
ORDER BY count DESC
LIMIT 5;
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /stats con datos | Grupo activo con miembros, mensajes, FAQs | Bot responde con estadísticas completas |
| QA2 | /stats grupo vacío | Grupo nuevo sin actividad | Bot responde con 0 en contadores |
| QA3 | /stats sin metadata | Bot no es admin, groupMetadata falla | Bot responde "❌ No se pudo obtener metadata" |
| QA4 | No-admin ejecuta | Número no admin escribe /stats | Bot ignora |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `wbot.groupMetadata(groupJid)` — API Baileys
- Modelo `Message` + `Ticket` para contar mensajes
- Modelo `BotCajeroLog` para FAQs, bienvenidas, spam
- Redis para último mensaje

### Esfuerzo Estimado

**Bajo** (~2-3 horas). Son 4 queries SQL + 1 llamada a API de Baileys + formateo de respuesta.

---

<a name="2-sorteo"></a>
## 2️⃣ /sorteo — Sorteo Aleatorio de Miembros

### User Story

```
Como administrador,
quiero escribir /sorteo <premio> en el chat privado del bot
para que el bot elija un ganador aleatorio del grupo
y lo anuncie automáticamente con mención.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/sorteo <premio>` en el switch de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/sorteo Camiseta del Club Bolívar"
2. HandlePrivateCommand detecta comando "/sorteo":
   a. Extraer premio después de "/sorteo " (trim)
   b. Si premio vacío → responder: "❌ Debes especificar un premio. Ej: /sorteo Camiseta oficial"
   c. Obtener wbot de la sesión: getWbot(whatsappId)
   d. Obtener metadata del grupo:
      const metadata = await wbot.groupMetadata(config.groupJid)
   e. Filtrar participantes:
      const participants = metadata.participants
        .filter(p => p.id !== botJid)  // excluir al bot
        .map(p => p.id)
   f. Si participants.length < 2:
      → "❌ Se necesitan al menos 2 participantes para un sorteo."
   g. Elegir ganador aleatorio:
      const winnerJid = participants[Math.floor(Math.random() * participants.length)]
   h. Obtener nombre del ganador (del contacto o "Usuario"):
      const contact = await Contact.findOne({ where: { number: extractNumber(winnerJid) } })
      const winnerName = contact?.name || winnerJid.split('@')[0]
   i. Enviar anuncio al GRUPO con mención:
      await whatsappProvider.sendMessage(whatsappId, config.groupJid, 
        `🎉 SORTEO\n\nPremio: ${premio}\nGanador: @${winnerName}\n\n¡Felicidades! 🥳`,
        { mentions: [winnerJid] }  // ← soporte de menciones en sendMessage
      )
   j. Responder al ADMIN:
      "✅ Sorteo realizado. Ganador: {winnerName} ({winnerJid})"
   k. Crear BotCajeroLog con eventType: 'sorteo', detail: premio
```

**Soporte de menciones en sendMessage:**

Actualmente `sendMessage` en whaileys.ts acepta `options?.quotedMessageId`. Se debe agregar soporte para `mentions?: string[]`:

```typescript
// En whaileys.ts sendMessage():
const messageContent: AnyMessageContent = {
  text: body,
  mentions: options?.mentions || undefined,  // ← agregar
  contextInfo: options?.quotedMessageId ? { ... } : undefined
};
```

**Actualizar ProviderMessage types:**
```typescript
// En ProviderOptions.ts o similar
interface SendMessageOptions {
  quotedMessageId?: string;
  quotedMessageFromMe?: boolean;
  mentions?: string[];  // ← nuevo
}
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Sorteo exitoso | Admin escribe `/sorteo Camiseta` | Bot anuncia ganador en grupo con mención @ |
| QA2 | Sorteo sin premio | Admin escribe `/sorteo` | Bot responde "❌ Debes especificar un premio" |
| QA3 | Grupo sin miembros | Grupo con solo el bot | Bot responde "❌ Se necesitan al menos 2 participantes" |
| QA4 | Ganador es mencionado | Verificar mensaje en grupo | El JID del ganador está en mentionedJid[] |
| QA5 | Varios sorteos | Ejecutar 3 sorteos seguidos | Cada sorteo elige un ganador (puede repetirse aleatoriamente) |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `wbot.groupMetadata(groupJid)` — API Baileys
- Modificar `sendMessage` para soportar `mentions[]`
- `Contact` model para obtener nombre del ganador

### Esfuerzo Estimado

**Bajo** (~1-2 horas). Lógica simple: filtrar participantes, random, enviar con mención.

---

<a name="3-encuesta"></a>
## 3️⃣ /encuesta — Encuesta Nativa de WhatsApp

### User Story

```
Como administrador,
quiero escribir /encuesta <pregunta> | op1 | op2 en el chat privado del bot
para crear una encuesta nativa de WhatsApp en el grupo
y que los miembros voten directamente desde la interfaz de WhatsApp.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/encuesta <pregunta> \| op1 \| op2` en el switch de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/encuesta ¿Qué partido ves hoy? | Bolívar vs Always | The Strongest vs Wilstermann | No sé aún"
2. HandlePrivateCommand detecta comando "/encuesta":
   a. Extraer resto después de "/encuesta "
   b. Separar por " | " (espacio-pipe-espacio):
      parts = resto.split(" | ")
      pregunta = parts[0]
      opciones = parts.slice(1)
   c. Validar que haya al menos 3 partes (pregunta + 2 opciones):
      → Si < 3: "❌ Formato: /encuesta Pregunta | Op1 | Op2 (mínimo 2 opciones)"
   d. Validar máximo 5 opciones:
      → Si opciones.length > 5: "❌ Máximo 5 opciones permitidas."
   e. Validar que pregunta no esté vacía:
      → Si pregunta.trim() === "": "❌ La pregunta no puede estar vacía."
   f. Validar que cada opción no esté vacía:
      → Si alguna opción está vacía: "❌ Todas las opciones deben tener texto."
   g. Obtener wbot de la sesión: getWbot(whatsappId)
   h. Enviar encuesta nativa al grupo via Baileys:
      const pollMessage = {
        poll: {
          name: pregunta.trim(),
          values: opciones.map(o => ({ optionName: o.trim() })),
          selectableCount: 1  // voto único
        }
      }
      await wbot.sendMessage(config.groupJid, pollMessage)
   i. Responder al ADMIN:
      "✅ Encuesta publicada en el grupo:\n{pregunta}\n{opciones.length} opciones"
   j. Crear BotCajeroLog con eventType: 'encuesta', detail: pregunta
```

**Consideraciones técnicas:**
- El tipo `poll` en Baileys es un objeto `MessagePollCreationMessage`. Probablemente se envía como:
  ```typescript
  await wbot.sendMessage(jid, {
    poll: {
      name: "¿Pregunta?",
      values: [{ optionName: "Op1" }, { optionName: "Op2" }],
      selectableCount: 1
    }
  });
  ```
- `selectableCount` es la cantidad de opciones que cada usuario puede seleccionar. Para encuestas simples, siempre 1.
- Si Baileys no soporta `poll` directamente, verificar la versión de la librería. Alternativa: enviar como mensaje de texto con formato.

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Encuesta 2 opciones | Admin escribe `/encuesta ¿Sí o no? | Sí | No` | Encuesta nativa aparece en el grupo con 2 opciones |
| QA2 | Encuesta 5 opciones | Admin escribe con 5 opciones | Encuesta se crea correctamente |
| QA3 | Menos de 2 opciones | Admin escribe `/encuesta ¿Qué? | Solo una` | Bot responde "❌ mínimo 2 opciones" |
| QA4 | Más de 5 opciones | Admin escribe con 6 opciones | Bot responde "❌ Máximo 5 opciones" |
| QA5 | Pregunta vacía | Admin escribe `/encuesta \| a \| b` | Bot responde "❌ La pregunta no puede estar vacía" |

### Dependencias

- `HandlePrivateCommand.ts` existente
- Baileys debe soportar `poll` en `sendMessage` (verificar en documentación de Baileys/whaileys)

### Esfuerzo Estimado

**Bajo** (~1-2 horas). Parseo simple, una llamada a API de Baileys. Puede requerir investigación sobre el formato exacto del poll en Baileys.

---

<a name="4-recordar"></a>
## 4️⃣ /recordar — Recordatorios Programados

### User Story

```
Como administrador,
quiero programar recordatorios que el bot envíe al grupo en una fecha/hora específica
para no olvidar avisos importantes como "mañana hay clásico" o "hoy cierran las inscripciones".
```

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/BotCajeroReminderService.ts` | Servicio de recordatorios: crear, listar, cancelar, ejecutar |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar cases: `/recordar`, `/recordar list`, `/recordar cancel <id>` |
| `backend/src/server.ts` o scheduler existente | Inicializar timer que revisa recordatorios cada 60s |

### Modelo de Datos — `BotCajeroReminder`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| id | INTEGER | PK, Auto Increment | |
| botCajeroConfigId | INTEGER | FK → BotCajeroConfig.id, ON DELETE CASCADE | |
| message | TEXT | NOT NULL | Mensaje a enviar |
| scheduledAt | DATETIME | NOT NULL | Cuándo enviar |
| sent | BOOLEAN | DEFAULT false | Si ya fue enviado |
| cancelled | BOOLEAN | DEFAULT false | Si fue cancelado |
| createdAt | DATETIME | NOT NULL | |

### Migración

```
20260527000001-create-botcajero-reminders.ts
```

### Flujo Detallado

#### Comando: `/recordar <cuando> <mensaje>`

```
1. Admin escribe: "/recordar mañana 10:00 Hoy hay clásico Bolivia vs Chile"
2. HandlePrivateCommand detecta "/recordar":
   a. Extraer texto después de "/recordar "
   b. Parsear fecha del texto:
      - "hoy HH:MM" → fecha = hoy a las HH:MM
      - "mañana HH:MM" → fecha = mañana a las HH:MM
      - "lunes HH:MM" → fecha = próximo lunes a las HH:MM
      - "DD/MM HH:MM" → fecha = día específico
      - Si no se puede parsear: "❌ Formato: /recordar mañana 10:00 Mensaje. Usa: hoy, mañana, lunes-dom, o DD/MM"
   c. Extraer mensaje (todo después del timestamp parseado)
   d. Si scheduledAt < ahora: "❌ La fecha debe ser en el futuro."
   e. Crear BotCajeroReminder en DB
   f. Responder: "✅ Recordatorio programado para {fecha formateada}:\n{mensaje}"
   g. Crear BotCajeroLog eventType: 'reminder', detail: mensaje
```

#### Comando: `/recordar list`

```
1. Admin escribe: "/recordar list"
2. Buscar recordatorios activos (sent=false, cancelled=false) ordenados por scheduledAt ASC
3. Si no hay: "📋 No hay recordatorios programados."
4. Si hay:
   "📋 Recordatorios activos:
   #{id} — {fecha} — {mensaje resumido}
   #{id} — {fecha} — {mensaje resumido}
   ...
   Usa /recordar cancel <id> para cancelar uno."
```

#### Comando: `/recordar cancel <id>`

```
1. Admin escribe: "/recordar cancel 3"
2. Buscar recordatorio por id
3. Si no existe: "❌ Recordatorio no encontrado."
4. Si ya fue enviado: "❌ El recordatorio ya fue enviado."
5. Si ya fue cancelado: "❌ El recordatorio ya está cancelado."
6. cancelled = true
7. Responder: "✅ Recordatorio #{id} cancelado."
```

#### Ejecución (timer cada 60s)

```typescript
// En server.ts o BotCajeroReminderService.init()
setInterval(async () => {
  const pendings = await BotCajeroReminder.findAll({
    where: { sent: false, cancelled: false, scheduledAt: { [Op.lte]: new Date() } },
    include: [{ model: BotCajeroConfig, required: true }]
  });
  
  for (const reminder of pendings) {
    try {
      const config = reminder.botCajeroConfig; // eager loaded
      await whatsappProvider.sendMessage(config.whatsappId, config.groupJid, 
        `⏰ RECORDATORIO\n\n${reminder.message}`);
      reminder.sent = true;
      await reminder.save();
    } catch (err) {
      logger.error({ info: "BotCajero - Failed to send reminder", error: (err as Error).message });
    }
  }
}, 60 * 1000); // cada 60 segundos
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Recordar mañana | `/recordar mañana 10:00 Partido hoy` | Recordatorio creado. Se envía mañana a las 10:00. |
| QA2 | Recordar hoy | `/recordar hoy 15:30 Cierre inscripciones` | Se envía hoy a las 15:30 |
| QA3 | Listar recordatorios | `/recordar list` después de crear 3 | Lista los 3 con IDs |
| QA4 | Cancelar recordatorio | `/recordar cancel 1` | Recordatorio #1 marcado cancelado |
| QA5 | Fecha inválida | `/recordar pasadomañana 10:00 algo` | Bot responde "❌ Formato inválido" |
| QA6 | Fecha en pasado | `/recordar ayer 10:00 algo` | Bot responde "❌ Debe ser en el futuro" |

### Dependencias

- `HandlePrivateCommand.ts` existente
- Nuevo modelo `BotCajeroReminder`
- Timer/setInterval en server.ts
- `whatsappProvider.sendMessage()`

### Esfuerzo Estimado

**Medio** (~4-5 horas). Requiere migración, modelo nuevo, parser de fechas, timer, y 3 sub-comandos (crear, listar, cancelar).

---

<a name="5-alertas"></a>
## 5️⃣ Alertas al Admin

### User Story

```
Como administrador,
quiero recibir notificaciones automáticas del bot en mi chat privado
para enterarme de actividad importante (nuevos miembros, picos de spam, resumen diario)
sin tener que revisar el grupo constantemente.
```

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/AdminAlertService.ts` | Servicio de alertas: resumen diario, alerta de spam, notificación de miembros |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/AntiSpamService.ts` | Al detectar spam, verificar si es el 5to+ en 1h y disparar alerta |
| `backend/src/services/BotCajeroServices/GroupParticipantHandler.ts` | Después de bienvenida, verificar si toca enviar resumen |
| `backend/src/server.ts` | Inicializar timer de resumen diario |

### Flujo Detallado

#### Alerta A: Pico de spam (en AntiSpamService.ts)

```
Dentro de handleAntiSpam, DESPUÉS de detectar un evento de spam:
1. Obtener ID de la sesión/config
2. Contar eventos 'spam' en BotCajeroLog en la última hora:
   SELECT COUNT(*) FROM BotCajeroLogs
   WHERE eventType = 'spam'
     AND botCajeroConfigId = :configId
     AND createdAt >= (NOW() - INTERVAL 1 HOUR)
3. Si count >= 5 Y no se ha enviado alerta en la última hora:
   → Verificar Redis: "botcajero:alertaspam:{whatsappId}" (TTL 3600)
   → Si no existe:
     a. Enviar al admin en privado:
        "🚨 ALERTA DE SPAM\n\nSe detectaron {count} intentos de spam en la última hora.
        Recomendación: Revisa el grupo o activa /atencion off temporalmente."
     b. Guardar en Redis: setex("botcajero:alertaspam:{whatsappId}", 3600, "1")
```

#### Alerta B: Nuevos miembros (en GroupParticipantHandler.ts)

```
Al final de handle bienvenida (action="add"):
1. Contar bienvenidas en las últimas 24h:
   SELECT COUNT(*) FROM BotCajeroLogs
   WHERE eventType = 'welcome'
     AND botCajeroConfigId = :configId
     AND createdAt >= (NOW() - INTERVAL 24 HOUR)
2. Si count >= 3 (o cualquier umbral, configurable):
   → No enviar ahora, se incluye en el resumen diario
```

#### Alerta C: Resumen diario (timer)

```
// En server.ts, junto al timer de inactividad o separado
setInterval(async () => {
  const configs = await BotCajeroConfig.findAll({ where: { autoReplyEnabled: true } });
  
  for (const config of configs) {
    try {
      await sendDailySummary(config);
    } catch (err) {
      logger.error({ info: "BotCajero - Daily summary error", error: (err as Error).message });
    }
  }
}, 24 * 60 * 60 * 1000); // cada 24h
```

```
async function sendDailySummary(config: BotCajeroConfig):
  a. Verificar Redis: "botcajero:dailysummary:{config.whatsappId}:{fecha}"
     → si existe, ya se envió hoy → salir
  b. Query logs de las últimas 24h:
     nuevos = COUNT(eventType='welcome')
     faqs = COUNT(eventType='faq')
     spam = COUNT(eventType='spam')
     sorteos = COUNT(eventType='sorteo')
     promos = COUNT(eventType='promo')
  c. Enviar al admin:
     "📊 RESUMEN DIARIO
     
     🆕 Nuevos miembros: {nuevos}
     ❓ FAQs respondidas: {faqs}
     🛡️ Spam bloqueado: {spam}
     🎉 Sorteos realizados: {sorteos}
     📢 Promos enviadas: {promos}
     
     Generado el {fecha}"
  d. Guardar en Redis: setex("botcajero:dailysummary:{...}", 86400, "1")
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Alerta de spam | 5 eventos spam en 1 hora | Admin recibe alerta "🚨 ALERTA DE SPAM" |
| QA2 | Alerta no duplica | 8 eventos spam en 1 hora | Solo 1 alerta (la primera vez que llega a 5) |
| QA3 | Resumen diario | Timer ejecuta sendDailySummary | Admin recibe resumen con conteos |
| QA4 | Resumen no duplica | Timer se ejecuta 2 veces el mismo día | Solo 1 resumen (Redis TTL lo bloquea) |

### Dependencias

- `AntiSpamService.ts` existente
- `GroupParticipantHandler.ts` existente
- `BotCajeroLog` para consultas
- Redis para flags de no-duplicado
- `whatsappProvider.sendMessage()` para enviar al admin

### Esfuerzo Estimado

**Medio** (~4-5 horas). Tres sub-sistemas: spike detection en anti-spam, timer de resumen diario, y Redis flags anti-duplicado.

---

<a name="6-mute"></a>
## 6️⃣ /mute — Silenciar Usuario

### User Story

```
Como administrador,
quiero escribir /mute <jid> <horas> en el chat privado del bot
para que el bot ignore los mensajes de un usuario problemático por un tiempo,
sin necesidad de expulsarlo.
```

### Archivos a Crear

Ninguno. Se agrega lógica a `HandlePrivateCommand.ts` y `handleWhatsappEvents.ts`.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/mute <jid> <horas>` en el switch de comandos |
| `backend/src/handlers/handleWhatsappEvents.ts` | Agregar check de mute antes de anti-spam/FAQ en el bloque de BotCajero |

### Flujo Detallado

#### Comando: `/mute <jid> <horas>`

```
1. Admin escribe: "/mute 59171234567@c.us 2"
2. HandlePrivateCommand detecta "/mute":
   a. Extraer args después de "/mute "
   b. Parsear: parts = args.split(" ")
      jid = parts[0]
      hours = parseInt(parts[1]) || 1  (default 1 hora)
   c. Validar jid:
      → Si no hay jid: "❌ Debes especificar el JID. Ej: /mute 59171234567@c.us 2"
   d. Validar que no sea el admin:
      → Si jid contiene adminNumber: "❌ No puedes silenciarte a ti mismo."
   e. Validar que no sea el bot:
      → Si jid === botJid: "❌ No puedes silenciar al bot."
   f. Validar horas: (1-72)
      → Si hours < 1 o hours > 72: "❌ Las horas deben ser entre 1 y 72."
   g. Guardar en Redis TTL:
      Redis.setex(
        `botcajero:muted:${whatsappId}:${normalizeJid(jid)}`,
        hours * 3600,  // TTL en segundos
        Date.now().toString()
      )
   h. Responder: "✅ Usuario {jid} silenciado por {hours} hora(s)."
   i. Crear BotCajeroLog eventType: 'mute', detail: `${jid} - ${hours}h`
```

#### Check de mute en handleWhatsappEvents.ts

```
Dentro del bloque de BotCajero, ANTES de anti-spam:
  // 1.5 Check de mute (usuario silenciado)
  if (contactPayload.isGroup && !processedMessage.fromMe && processedMessage.body) {
    const muteKey = `botcajero:muted:${contextPayload.whatsappId}:${contactPayload.number}`;
    const muted = await getRedisClient()?.get(muteKey);
    if (muted) {
      // Usuario está muteado → NO procesar anti-spam, FAQ, ni group commands
      return;  // salir del bloque de BotCajero
    }
  }
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Mute exitoso | Admin escribe `/mute 59171234567@c.us 2` | Usuario silenciado por 2h. Sus mensajes no gatillan FAQ/spam. |
| QA2 | Mute expira | Esperar 2h + 1min | Usuario ya no está muteado. FAQ/spam funcionan normal. |
| QA3 | Mute sin JID | Admin escribe `/mute` | Bot responde "❌ Debes especificar el JID" |
| QA4 | Mute al admin | Admin escribe `/mute {su propio jid} 1` | Bot responde "❌ No puedes silenciarte a ti mismo" |
| QA5 | Mute al bot | Admin escribe `/mute {botJid} 1` | Bot responde "❌ No puedes silenciar al bot" |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `redisStore` existente (`getRedisClient()`)
- `handleWhatsappEvents.ts` — agregar check antes de paso 2 (anti-spam)

### Esfuerzo Estimado

**Medio** (~2-3 horas). Lógica simple pero requiere modificar el handler principal con cuidado de no romper el flujo existente.

---

<a name="7-horario-toggle"></a>
## 7️⃣ /horario on/off — Toggle de Horarios de Atención

### User Story

```
Como administrador,
quiero activar o desactivar la respuesta @bot horarios desde un comando
para controlar cuándo los miembros pueden consultar los horarios,
sin borrar los datos configurados.
```

### Archivos a Crear

Ninguno.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/models/BotCajeroConfig.ts` | Agregar columna `businessHoursEnabled: BOOLEAN, DEFAULT true` |
| Migración nueva | `20260527000002-add-business-hours-enabled-to-botcajero-config.ts` |
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar cases `/horario on` y `/horario off` |
| `backend/src/services/BotCajeroServices/GroupCommandHandler.ts` | En caso "horarios", verificar `config.businessHoursEnabled` antes de responder |

### Migración

```typescript
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroConfigs", "businessHoursEnabled", {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("BotCajeroConfigs", "businessHoursEnabled");
  }
};
```

### Flujo Detallado

```
/horario on:
  config.businessHoursEnabled = true
  await config.save()
  Responder: "✅ Respuesta de horarios activada. Los miembros pueden usar @bot horarios."

/horario off:
  config.businessHoursEnabled = false
  await config.save()
  Responder: "⛔ Respuesta de horarios desactivada. @bot horarios no responderá."

En GroupCommandHandler.ts, caso "horarios":
  if (!config.businessHoursEnabled) {
    await sendMessage(whatsappId, groupJid, "🤖 La consulta de horarios está desactivada.");
    return;
  }
  // continuar con la respuesta normal de horarios...
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /horario off | Admin escribe `/horario off` | Bot confirma desactivación |
| QA2 | @bot horarios desactivado | Miembro escribe `@bot horarios` después de /horario off | Bot responde "consulta desactivada" |
| QA3 | /horario on | Admin escribe `/horario on` | Bot confirma activación |
| QA4 | @bot horarios activado | Miembro escribe `@bot horarios` después de /horario on | Bot responde con horarios normalmente |

### Dependencias

- `GroupCommandHandler.ts` existente (feature v2.1)
- `HandlePrivateCommand.ts` existente
- Migración a BotCajeroConfig

### Esfuerzo Estimado

**Bajo** (~1 hora). 1 columna nueva, 2 lines en HandlePrivateCommand, 1 línea en GroupCommandHandler.

---

<a name="8-warn"></a>
## 8️⃣ /warn — Advertencia Pública

### User Story

```
Como administrador,
quiero escribir /warn <jid> en el chat privado del bot
para que el bot envíe una advertencia pública en el grupo mencionando al usuario,
sin tener que escribir yo mismo.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/warn <jid>` en el switch de comandos |

### Flujo Detallado

```
1. Admin escribe: "/warn 59171234567@c.us"
2. HandlePrivateCommand detecta "/warn":
   a. Extraer jid después de "/warn " (trim)
   b. Validar jid:
      → Si vacío: "❌ Debes especificar el JID. Ej: /warn 59171234567@c.us"
      → Si es el admin: "❌ No puedes advertirte a ti mismo."
      → Si es el bot: "❌ No puedes advertir al bot."
   c. Obtener nombre del usuario (del contacto o JID):
      const contact = await Contact.findOne({ where: { number: extractNumber(jid) } })
      const name = contact?.name || jid.split('@')[0]
   d. Enviar advertencia al GRUPO con mención:
      await whatsappProvider.sendMessage(whatsappId, config.groupJid,
        `⚠️ @${name}, has recibido una advertencia. Por favor respeta las reglas del grupo.`,
        { mentions: [jid] }
      )
   e. Responder al ADMIN:
      "✅ Advertencia enviada a {name} ({jid})."
   f. Crear BotCajeroLog con eventType: 'warn', detail: jid
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Warn exitoso | Admin escribe `/warn 59171234567@c.us` | Bot envía advertencia en grupo con mención @ |
| QA2 | Warn sin JID | Admin escribe `/warn` | Bot responde "❌ Debes especificar el JID" |
| QA3 | Warn al admin | Admin escribe `/warn {su jid}` | Bot responde "❌ No puedes advertirte a ti mismo" |
| QA4 | Warn al bot | Admin escribe `/warn {botJid}` | Bot responde "❌ No puedes advertir al bot" |

### Dependencias

- `HandlePrivateCommand.ts` existente
- Soporte de `mentions[]` en `sendMessage` (mismo que feature #2 /sorteo)

### Esfuerzo Estimado

**Bajo** (~30 min). Misma lógica que `/ban` pero solo envía mensaje, no expulsa.

---

<a name="9-export"></a>
## 9️⃣ /export — Exportar Config como JSON

### User Story

```
Como administrador,
quiero escribir /export en el chat privado del bot
para obtener un archivo JSON con toda la configuración del BotCajero
y poder respaldarla o transferirla a otro número.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar case `/export` en el switch de comandos |

### Flujo Detallado

```
1. Admin escribe: "/export"
2. HandlePrivateCommand detecta "/export":
   a. Obtener config completa con relaciones:
      const config = await BotCajeroConfig.findByPk(config.id, {
        include: [
          { model: BotCajeroFAQ, as: 'faqs', where: { enabled: true }, required: false },
          { model: BotCajeroSpamRule, as: 'spamRules', where: { enabled: true }, required: false },
          { model: BotCajeroSticker, as: 'stickers', required: false }
        ]
      })
   b. Construir objeto JSON exportable:
      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        config: {
          groupJid: config.groupJid,
          groupName: config.groupName,
          adminNumber: config.adminNumber,
          welcomeEnabled: config.welcomeEnabled,
          farewellEnabled: config.farewellEnabled,
          autoReplyEnabled: config.autoReplyEnabled,
          antiSpamEnabled: config.antiSpamEnabled,
          quietModeStart: config.quietModeStart,
          quietModeEnd: config.quietModeEnd,
          inactivityHours: config.inactivityHours,
          welcomeMessage: config.welcomeMessage,
          farewellMessage: config.farewellMessage,
          rules: config.rules,
          businessHours: config.businessHours ? JSON.parse(config.businessHours) : null,
          businessHoursEnabled: config.businessHoursEnabled
        },
        faqs: config.faqs?.map(f => ({
          keywords: f.keywords,
          response: f.response,
          matchType: f.matchType,
          priority: f.priority
        })) || [],
        spamRules: config.spamRules?.map(s => ({
          type: s.type,
          pattern: s.pattern,
          action: s.action
        })) || [],
        stickerCount: config.stickers?.length || 0
      }
   c. Serializar a JSON string:
      const jsonString = JSON.stringify(exportData, null, 2)
   d. Enviar como archivo al ADMIN:
      const wbot = getWbot(whatsappId)
      await wbot.sendMessage(normalizeJid(fromNumber), {
        document: Buffer.from(jsonString, 'utf-8'),
        mimetype: 'application/json',
        fileName: `botcajero-config-${config.id}-${Date.now()}.json`
      })
   e. Responder (texto adicional):
      "✅ Configuración exportada. Archivo: botcajero-config-{id}-{timestamp}.json"
   f. Crear BotCajeroLog con eventType: 'export'
```

**Nota técnica:** El envío de documento usa `sendMessage` de Baileys directamente (no `whatsappProvider.sendMedia`) porque es un archivo JSON en memoria, no un archivo en disco.

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Export exitoso | Admin escribe `/export` | Bot envía archivo .json con toda la config |
| QA2 | JSON válido | Descargar y parsear el archivo | JSON es válido, contiene todas las secciones |
| QA3 | Export sin FAQs | Config sin FAQs creadas | JSON incluye `faqs: []` |
| QA4 | Export con datos completos | Config con FAQs, spam rules, stickers, horarios | JSON incluye todas las secciones pobladas |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `getWbot(sessionId)` para enviar documento directamente
- Modelos: `BotCajeroConfig`, `BotCajeroFAQ`, `BotCajeroSpamRule`, `BotCajeroSticker`

### Esfuerzo Estimado

**Bajo** (~1-2 horas). Serialización JSON + envío de documento por Baileys.

---

## Orden de Implementación Recomendado

```
DÍA 1 — Grupo C (bajo, rápido):
  [ ] #8  /warn       — 30 min
  [ ] #7  /horario    — 1h (incluye migración)
  [ ] #9  /export     — 1h

DÍA 2 — Grupo A (bajo, alto valor):
  [ ] #1  /stats      — 2h
  [ ] #2  /sorteo     — 1h (requiere mentions[])
  [ ] #3  /encuesta   — 1h

DÍA 3 — Grupo B (medio):
  [ ] #6  /mute       — 2h (handler + Redis)
  [ ] #4  /recordar   — 4h (modelo + parser fechas + timer)

DÍA 4:
  [ ] #5  Alertas     — 4h (spike detection + daily summary)
  [ ] QA + perf       — 2h

Total estimado: ~5-6 días hábiles
```

---

*Documento generado el 2026-05-26. BotCajero v3 — 9 Nuevas Funcionalidades. WhaTicket Community Edition.*
