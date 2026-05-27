# BotCajero v2 — Nuevas Funcionalidades

## Especificación de Software — 5 Features para BotCajero

> **Basado en**: `handoff/spec-botcajero.md` (módulo existente)
> **Estado actual**: BotCajero v1 implementado. Pipeline en Fase 4 (perf) completada.
> **Stack**: Node.js + TypeScript + Express + Sequelize + MySQL + Redis + Baileys

---

## Tabla de Contenido

1. [@BotCajero — Menciones en Grupo (Group Commands)](#1-mentions)
2. [/say — Comando Privado para Enviar Texto Limpio al Grupo](#2-say)
3. [/link — Comando Privado para Obtener Link del Grupo](#3-link)
4. [@bot horarios — Consulta de Horarios de Atención](#4-business-hours)
5. [/ban — Comando Privado para Expulsar Miembro](#5-ban)

---

<a name="1-mentions"></a>
## 1️⃣ @BotCajero — Menciones en Grupo (Group Commands)

### User Story

```
Como miembro del grupo,
quiero mencionar al bot con @BotCajero seguido de un comando
para obtener información sin necesidad de preguntar a un humano.
```

```
Como administrador del grupo,
quiero que los miembros puedan consultar información básica
mediante menciones al bot en el grupo,
para reducir preguntas repetitivas.
```

### Archivos a Crear

| Archivo | Propósito |
|---------|-----------|
| `backend/src/services/BotCajeroServices/GroupCommandHandler.ts` | Router de comandos por mención. Detecta el comando, ejecuta acción, responde en el grupo |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/handlers/handleWhatsappEvents.ts` | Agregar hook después del FAQ block (paso 3) para detectar menciones al bot |
| `backend/src/handlers/handleWhatsappEvents.ts` | Agregar `mentionedJid` al `MessagePayload` export (si no existe aún) |
| `backend/src/providers/WhatsApp/Implementations/whaileys.ts` | Extraer `contextInfo.mentionedJid` al construir `messagePayload` |
| `backend/src/providers/WhatsApp/types/ProviderMessage.ts` | Agregar campo opcional `mentionedJid?: string[]` |

### Flujo Detallado

```
1. Llega mensaje al grupo (isGroup = true, fromMe = false)
2. Se procesa normalmente: ticket, CreateMessageService, etc.
3. Después del FAQ block en handleWhatsappEvents:
   ┌───────────────────────────────────────────────┐
   │ 3.5 Group Commands (menciones @bot)            │
   └───────────────────────────────────────────────┘
   a. Verificar que processedMessage.mentionedJid existe y NO está vacío
   b. Obtener botJid de la sesión (wbot.user.id)
   c. Verificar que botJid está en mentionedJid[]
   d. Si no está mencionado → salir
   e. Si está mencionado:
      i. Parsear el mensaje: extraer texto DESPUÉS de la mención
         - "@BotCajero reglas" → comando = "reglas"
         - "@BotCajero ayuda" → comando = "ayuda"  
         - "@BotCajero help" → comando = "help"
         - "@BotCajero horarios" → comando = "horarios"
      ii. Validar quiet mode: si isInQuietMode(config) → salir (igual que FAQ)
      iii. Buscar BotCajeroConfig para este whatsappId + groupJid
      iv. Ejecutar comando:
          ┌──────────────┬────────────────────────────────────┐
          │ Comando      │ Acción                             │
          ├──────────────┼────────────────────────────────────┤
          │ "reglas"     │ Enviar config.rules al grupo       │
          │ "ayuda"/"help"│ Enviar lista de comandos al grupo │
          │ "horarios"   │ Enviar businessHours al grupo      │
          └──────────────┴────────────────────────────────────┘
      v. Si comando no reconocido → enviar ayuda (fallback)
      vi. Crear BotCajeroLog eventType: 'group_command'
```

### Respuestas del Bot en Grupo

```
@Usuario reglas:
🤖 Reglas del grupo:
📜 {rules}

@Usuario ayuda:
🤖 Comandos disponibles en este grupo:
• @bot reglas — Muestra las reglas del grupo
• @bot ayuda — Muestra esta ayuda
• @bot horarios — Muestra horarios de atención

@Usuario horarios:
🤖 Horarios de atención:
{businessHours formateado}

Si el comando no se reconoce:
🤖 Comando no reconocido. Usa @bot ayuda para ver los disponibles.
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Mencionar @bot reglas | Miembro escribe "@BotCajero reglas" en grupo | Bot responde en grupo con las reglas |
| QA2 | Mencionar @bot ayuda | Miembro escribe "@BotCajero ayuda" | Bot responde lista de comandos |
| QA3 | Sin mención | Miembro escribe "reglas" sin @bot | Bot NO responde |
| QA4 | Quiet mode respeta | De 23:00 a 08:00, miembro menciona @bot reglas | Bot NO responde |
| QA5 | Múltiples menciones | Miembro menciona @bot y otro contacto | Bot solo responde si él está en mentionedJid |

### Dependencias

- BotCajeroConfig existente (modelo + GetConfigService)
- `isInQuietMode()` existente (QuietModeService.ts)
- `mentionedJid[]` disponible en messagePayload (requiere modificación del provider)

### Esfuerzo Estimado

**Bajo** (~2-3 horas). Ya existen los servicios de configuración y quiet mode. Solo crear el router de comandos y agregar el hook.

---

<a name="2-say"></a>
## 2️⃣ /say — Comando Privado para Enviar Texto Limpio al Grupo

### User Story

```
Como administrador,
quiero enviar un mensaje de texto limpio al grupo desde mi chat privado
para avisar recordatorios, cambios de horario o cualquier anuncio rápido,
sin el formato de promoción que tiene /promo.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar caso para `/say <texto>` en el switch/router de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/say Recuerden que mañana no hay atención."
2. HandlePrivateCommand detecta comando "/say":
   a. Extraer texto después de "/say " (trim)
   b. Si texto está vacío → responder: "❌ Debes incluir un mensaje. Ej: /say Recuerden que..."
   c. Enviar texto AL GRUPO (config.groupJid):
      await whatsappProvider.sendMessage(whatsappId, config.groupJid, sayText)
   d. Responder al ADMIN:
      "✅ Mensaje enviado al grupo."
   e. Crear BotCajeroLog con eventType: 'say'
```

**Diferencia con `/promo`:**

| Aspecto | `/promo` | `/say` |
|---------|----------|--------|
| Formato | "📢 PROMO DEL DÍA:\n\n{texto}" | Texto limpio, sin prefijo |
| Uso | Promociones oficiales | Avisos, recordatorios, comunicación general |
| Log eventType | `'promo'` | `'say'` |

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /say básico | Admin escribe: `/say Recuerden que mañana cerramos` | El texto exacto aparece en el grupo |
| QA2 | /say vacío | Admin escribe: `/say ` | Bot responde "❌ Debes incluir un mensaje" |
| QA3 | /say con texto largo | Admin escribe: `/say ` + texto de 500 caracteres | El texto completo aparece en el grupo |
| QA4 | No-admin no puede | Número no admin escribe `/say test` | Bot ignora (validación existente) |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `whatsappProvider.sendMessage()` existente

### Esfuerzo Estimado

**Bajo** (~30 min). Es una línea más en el switch de comandos.

---

<a name="3-link"></a>
## 3️⃣ /link — Comando Privado para Obtener Link del Grupo

### User Story

```
Como administrador,
quiero escribir /link en el chat privado del bot
para obtener el link de invitación del grupo
y compartirlo con nuevos clientes sin tener que entrar a la app.
```

### Archivos a Crear

Ninguno. Se agrega al `HandlePrivateCommand.ts` existente.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar caso para `/link` en el switch/router de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/link"
2. HandlePrivateCommand detecta comando "/link":
   a. Obtener wbot de la sesión: getWbot(whatsappId)
   b. Llamar API de Baileys para obtener código de invitación:
      const inviteCode = await wbot.groupInviteCode(config.groupJid)
   c. Construir URL:
      const inviteLink = `https://chat.whatsapp.com/${inviteCode}`
   d. Responder al ADMIN:
      "🔗 Link de invitación:\n{inviteLink}\n\n⚠️ Comparte solo con personas de confianza."
   e. Crear BotCajeroLog con eventType: 'link'
```

**Manejo de errores:**
- Si `groupInviteCode` falla (el bot no es admin): responder "❌ El bot necesita ser administrador del grupo para obtener el link."
- Si el grupo no existe o no se encuentra: responder "❌ No se pudo obtener el link. Verifica la configuración."

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /link exitoso | Admin escribe `/link` | Bot responde con URL https://chat.whatsapp.com/... |
| QA2 | /link sin permisos | Bot NO es admin del grupo | Bot responde "❌ El bot necesita ser administrador" |
| QA3 | Grupo no configurado | No hay config activa | No hay respuesta (validación existente) |

### Dependencias

- `getWbot(sessionId)` — función existente en whaileys.ts
- `wbot.groupInviteCode(groupJid)` — API nativa de Baileys
- El bot necesita ser **admin del grupo** para ejecutar esta función

### Esfuerzo Estimado

**Bajo** (~30 min). Una llamada a API de Baileys existente.

---

<a name="4-business-hours"></a>
## 4️⃣ @bot horarios — Consulta de Horarios de Atención

### User Story

```
Como miembro del grupo,
quiero escribir @bot horarios en el grupo
para conocer los horarios de atención del negocio.
```

```
Como administrador,
quiero configurar los horarios de atención desde la UI
para que los miembros los consulten automáticamente.
```

### Archivos a Crear

Ninguno. Se agrega lógica a:
- `GroupCommandHandler.ts` (nuevo, feature 1) — caso "horarios"
- Modelo `BotCajeroConfig` — nuevo campo `businessHours`

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/models/BotCajeroConfig.ts` | Agregar columna `businessHours: TEXT, allowNull: true` |
| Migración nueva | `20260526000001-add-business-hours-to-botcajero-config.ts` |
| `backend/src/services/BotCajeroServices/GroupCommandHandler.ts` | Agregar caso "horarios" que formatea businessHours y lo envía al grupo |
| `frontend/src/pages/BotCajero/index.js` | Agregar campo "Horarios de Atención" (textarea JSON o campos por día) en tab Config |

### Migración

```typescript
// 20260526000001-add-business-hours-to-botcajero-config.ts
module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroConfigs", "businessHours", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("BotCajeroConfigs", "businessHours");
  }
};
```

### Formato de businessHours (JSON)

```json
{
  "lunes": "09:00-20:00",
  "martes": "09:00-20:00",
  "miercoles": "09:00-20:00",
  "jueves": "09:00-20:00",
  "viernes": "09:00-20:00",
  "sabado": "09:00-18:00",
  "domingo": "10:00-14:00"
}
```

### Flujo Detallado

**Para el miembro del grupo (runtime):**
```
1. Miembro escribe "@BotCajero horarios"
2. GroupCommandHandler detecta comando "horarios"
3. Verificar quiet mode
4. Obtener config con businessHours
5. Si businessHours es null o vacío:
   → Enviar: "🤖 No hay horarios configurados todavía."
6. Si businessHours tiene datos:
   a. Parsear JSON
   b. Formatear como texto:
      "🤖 Horarios de atención:
      🗓️ Lunes: 09:00-20:00
      🗓️ Martes: 09:00-20:00
      🗓️ Miércoles: 09:00-20:00
      🗓️ Jueves: 09:00-20:00
      🗓️ Viernes: 09:00-20:00
      🗓️ Sábado: 09:00-18:00
      🗓️ Domingo: 10:00-14:00"
   c. Enviar al grupo
   d. Crear BotCajeroLog con eventType: 'business_hours'
```

**Para el admin (frontend):**
```
En la tab "Config" de la página BotCajero, agregar sección:
  "Horarios de Atención"
  ┌────────────────────────────────────┐
  │ Lunes:     [09:00] a [20:00]       │
  │ Martes:    [09:00] a [20:00]       │
  │ Miércoles: [09:00] a [20:00]       │
  │ Jueves:    [09:00] a [20:00]       │
  │ Viernes:   [09:00] a [20:00]       │
  │ Sábado:    [09:00] a [18:00]       │
  │ Domingo:   [10:00] a [14:00]       │
  │            [Guardar Horarios]      │
  └────────────────────────────────────┘
  Alternativa simple (MVP): TextField multiline donde el admin pega el JSON
```

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | Consultar horarios configurados | Miembro escribe `@bot horarios` | Bot responde con horarios formateados por día |
| QA2 | Sin horarios configurados | Miembro escribe `@bot horarios`, businessHours = null | Bot responde "No hay horarios configurados" |
| QA3 | JSON inválido | businessHours tiene JSON corrupto | Bot responde "Error al cargar horarios. Contacta al administrador." |
| QA4 | Día sin horario | JSON no incluye "domingo" | Ese día no se muestra en la lista |
| QA5 | Quiet mode | De noche, miembro escribe `@bot horarios` | Bot NO responde |

### Dependencias

- Feature #1 (GroupCommandHandler.ts) debe existir
- Migración a BotCajeroConfig
- Frontend para editar el campo

### Esfuerzo Estimado

**Medio** (~3-4 horas). Requiere migración + modificación de modelo + frontend para el nuevo campo.

---

<a name="5-ban"></a>
## 5️⃣ /ban — Comando Privado para Expulsar Miembro

### User Story

```
Como administrador,
quiero escribir /ban seguido del JID de un miembro
para expulsarlo del grupo desde mi chat privado,
sin tener que entrar al grupo.
```

### Archivos a Crear

Ninguno. Se agrega lógica a `HandlePrivateCommand.ts`.

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/services/BotCajeroServices/HandlePrivateCommand.ts` | Agregar caso `/ban <jid>` en el switch de comandos |

### Flujo Detallado

```
1. Admin escribe en privado: "/ban 59171234567@c.us"
2. HandlePrivateCommand detecta comando "/ban":
   a. Extraer jid después de "/ban " (trim)
   b. Validar que jid NO esté vacío:
      → Si vacío: "❌ Debes especificar el JID del usuario. Ej: /ban 59171234567@c.us"
   c. Validar que jid sea diferente al admin:
      → Si es el admin: "❌ No puedes expulsarte a ti mismo."
   d. Validar que jid sea diferente al bot:
      → Obtener botJid de getWbot(whatsappId).user.id
      → Si es el bot: "❌ No puedes expulsar al bot."
   e. Obtener wbot de la sesión
   f. Llamar API de Baileys para expulsar:
      await wbot.groupParticipantsUpdate(
        config.groupJid,
        [jid],           // array de JIDs a expulsar
        "remove"         // acción: "add" | "remove" | "promote" | "demote"
      )
   g. Responder al ADMIN:
      "✅ Usuario {jid} expulsado del grupo."
   h. Crear BotCajeroLog con eventType: 'ban'
```

**Manejo de errores:**
- Si `groupParticipantsUpdate` lanza error (bot no es admin, usuario no está en el grupo):
  → "❌ No se pudo expulsar al usuario. El bot necesita ser administrador del grupo."
- Si el usuario ya no está en el grupo:
  → "❌ El usuario no es miembro del grupo."

**Consideraciones de seguridad:**
- SOLO el admin configurado en `adminNumber` puede ejecutar `/ban`
- El bot DEBE ser admin del grupo (validación en runtime)
- Se registra en log para auditoría

### Criterios QA

| # | Escenario | Pasos | Resultado |
|---|-----------|-------|-----------|
| QA1 | /ban exitoso | Admin escribe `/ban 59171234567@c.us` | Usuario expulsado del grupo. Admin recibe confirmación. |
| QA2 | /ban sin JID | Admin escribe `/ban` | Bot responde "❌ Debes especificar el JID" |
| QA3 | /ban al admin | Admin escribe `/ban {su propio jid}` | Bot responde "❌ No puedes expulsarte a ti mismo" |
| QA4 | /ban al bot | Admin escribe `/ban {jid del bot}` | Bot responde "❌ No puedes expulsar al bot" |
| QA5 | /ban sin permisos | Bot no es admin del grupo | Bot responde "❌ El bot necesita ser administrador" |
| QA6 | No-admin intenta | Número no admin escribe `/ban x@c.us` | Bot ignora (validación existente) |

### Dependencias

- `HandlePrivateCommand.ts` existente
- `getWbot(sessionId)` existente
- `wbot.groupParticipantsUpdate(groupJid, [jid], "remove")` — API nativa de Baileys
- El bot necesita ser **admin del grupo**
- Se recomienda tener una **confirmación** antes de ejecutar (como en Reenvío Automático) para evitar accidentes

### Esfuerzo Estimado

**Medio** (~2-3 horas). La lógica es simple pero es sensible (expulsión de miembros). Requiere manejo de errores robusto.

---

## Tabla Resumen de Esfuerzo

| # | Feature | Archivos nuevos | Archivos modificados | Esfuerzo | Depende de |
|---|---------|:---------------:|:--------------------:|:--------:|:----------:|
| 1 | @BotCajero menciones | 1 | 3 | Bajo | Nada |
| 2 | /say | 0 | 1 | Bajo | #1 no necesario |
| 3 | /link | 0 | 1 | Bajo | Nada |
| 4 | @bot horarios | 0 | 4 | Medio | #1 |
| 5 | /ban | 0 | 1 | Medio | Nada |

## Orden de Implementación Recomendado

```
Día 1:  Feature 1 (@bot reglas + @bot ayuda) → Bajo, desbloquea feature 4
        Feature 2 (/say) → Bajo, 30 min
        Feature 3 (/link) → Bajo, 30 min
        
Día 2:  Feature 4 (@bot horarios + migración + frontend) → Medio
        
Día 3:  Feature 5 (/ban) → Medio, sensible, probar con cuidado
        
Día 4:  QA + Performance
```

---

*Documento generado el 2026-05-26. BotCajero v2 — 5 Nuevas Funcionalidades. WhaTicket Community Edition.*
