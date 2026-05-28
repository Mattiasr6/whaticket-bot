# Pipeline: BotCajero — Bot moderador WhatsApp + asistente admin por comandos privados (backend Node.js)

## Phase: code-web

## Backend cleanup complete — FlowBot-only version

Removed all Ticket/Message/Queue/QuickAnswer/ScheduledMessage/BotRule features.
Compilation clean (tsc --noEmit exit 0).

### Files deleted: 29
- 9 models, 6 service dirs, 6 controllers, 6 routes, 2 api files, 4 helpers, 3 wbot services

### Files modified: 16
- database/index, routes/index, User/Contact/Whatsapp models
- handleWhatsappEvents (stripped tickets/messages, kept contacts+AI+FlowBot+AutoForward+BotCajero)
- All ContactServices, UserServices, WhatsappService
- AiAgent services (removed BotRule/ScheduledMessage tools)
- ContactController, UserController, WhatsAppController
- SerializeUser helper

### Features kept
FlowBot + Cron Jobs + AI Agent + Connections + Contacts + Users + Settings + BotCajero
