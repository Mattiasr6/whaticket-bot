import { logger } from "../../utils/logger";
import Setting from "../../models/Setting";
import buildContext from "./AiAgentContextBuilder";
import executeTool from "./AiAgentToolExecutor";

interface DecideContext {
  whatsappId: number;
  messageBody: string;
  fromJid: string;
  isGroup: boolean;
  groupJid?: string;
}

interface CronJobContext {
  jobName: string;
  actionType: string;
  config: string | null;
  whatsappId: number | null;
}

const buildSystemPrompt = (context: Awaited<ReturnType<typeof buildContext>>): string => {
  const instructions = context.activeInstructions
    .map(i => `[PRIORITY ${i.priority}] ${i.instruction}`)
    .join("\n");

  const rules = context.activeBotRules
    .map(r => `[${r.matchType}] keywords="${r.keywords}" → response="${r.response}"`)
    .join("\n");

  const rawJid = context.incomingMessage.fromJid;
  const displayJid = rawJid.includes("@") ? rawJid : `${rawJid}@s.whatsapp.net`;
  const groupJidLine = context.incomingMessage.groupJid
    ? `JID del grupo: ${context.incomingMessage.groupJid}`
    : undefined;

  return [
    "Eres un AI Agent para WhatsApp. Tu rol es analizar mensajes entrantes y decidir cómo responder.",
    "",
    "=== INSTRUCCIONES ACTIVAS ===",
    instructions || "(ninguna)",
    "",
    "=== REGLAS DEL BOT ACTIVAS ===",
    rules || "(ninguna)",
    "",
    "=== CRON JOBS ACTIVOS ===",
    context.activeCronJobs.map(j => `- ${j.name} (${j.actionType}): cada "${j.cronExpr}"`).join("\n") || "(ninguno)",
    "",
    "=== ESTADO ===",
    `WhatsApp status: ${context.whatsappStatus}`,
    `Hora actual: ${context.currentTime}`,
    `Usuario que escribe: ${displayJid}`,
    `Es grupo: ${context.incomingMessage.isGroup ? "sí" : "no"}`,
    groupJidLine,
    "",
  "=== HERRAMIENTAS DISPONIBLES ===",
  "- send_text(toJid, body): Enviar mensaje de texto a un chat/grupo",
  "- send_image(toJid, mediaFile, caption?): Enviar imagen (archivo en public/)",
  "- get_chat_history(chatJid, limit?): Leer últimos mensajes",
  "- mark_read(chatJid): Marcar mensajes como leídos",
  "- list_groups(): Listar grupos del WhatsApp",
  "- list_contacts(): Listar contactos individuales",
  "- get_whatsapp_status(): Ver estado de la conexión",
  "- get_group_metadata(groupJid): Info de un grupo (miembros, nombre)",
  "- create_bot_rule(name, keywords, matchType, response, scope, priority?): Crear regla de auto-respuesta",
  "- list_bot_rules(): Listar reglas del bot",
  "- update_bot_rule(ruleId, ...): Modificar una regla",
  "- delete_bot_rule(ruleId): Eliminar regla",
  "- create_cron_job(name, cronExpr, actionType, config, whatsappId): Crear tarea programada",
  "- list_cron_jobs(): Listar tareas programadas",
  "- update_cron_job(jobId, ...): Modificar tarea",
  "- delete_cron_job(jobId): Eliminar tarea",
  "- toggle_cron_job(jobId, enabled): Activar/desactivar tarea",
  "- create_scheduled_message(whatsappId, groupJid, groupName, messageText?, mediaPath?, intervalMinutes): Crear mensaje programado por intervalo",
  "- list_scheduled_messages(): Listar mensajes programados",
  "- delete_scheduled_message(id): Eliminar mensaje programado",
  "- add_instruction(instruction, priority?): Agregar instrucción para el agente",
  "- list_instructions(): Listar instrucciones activas",
  "- remove_instruction(instructionId): Eliminar instrucción",
  "",
  "=== FORMATO DE RESPUESTA ===",
  "Siempre responde SOLO con el formato exacto. Usa el JID real del usuario, NO uses placeholders como {{chatJid}}:  ",
  "ACTION: <nombre_de_la_herramienta>",
  "PARAMS: {\"param1\": \"valor1\", \"param2\": \"valor2\"}",
  "MESSAGE: <explicación breve>",
  "",
  "Si decides NO hacer nada, responde con:",
  "ACTION: skip",
  "MESSAGE: <razón breve>"
  ].join("\n");
};

const decideAndAct = async (context: DecideContext): Promise<void> => {
  try {
    const aiEnabled = await Setting.findOne({
      where: { key: "aiAgentEnabled" }
    });

    if (!aiEnabled || aiEnabled.value !== "true") {
      return;
    }

    const fullContext = await buildContext(context.whatsappId, {
      messageBody: context.messageBody,
      fromJid: context.fromJid,
      isGroup: context.isGroup,
      groupJid: context.groupJid
    });

    const systemPrompt = buildSystemPrompt(fullContext);

    const apiKey = process.env.OPENCODE_API_KEY;
    const model = process.env.AI_MODEL || "deepseek-v4-flash";

    if (!apiKey) {
      logger.warn("[AiAgent] AI_API_KEY not configured, skipping AI decision");
      return;
    }

    const response = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context.messageBody }
        ],
        temperature: 0.5,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `[AiAgent] OpenCode Go API error: ${response.status} ${response.statusText} — ${errorBody}`
      );
      return;
    }

    const data = await response.json();
    const decision = data.choices?.[0]?.message?.content || "";

    logger.info(`[AiAgent] Decision: ${decision}`);

    const actionMatch = decision.match(/ACTION:\s*(\w+)/);
    const paramsMatch = decision.match(/PARAMS:\s*(\{[\s\S]*?\})/);

    if (actionMatch) {
      const action = actionMatch[1];

      if (action === "skip") {
        logger.info(`[AiAgent] AI skipped: ${decision}`);
        return;
      }

      let params: Record<string, unknown> = {};
      if (paramsMatch) {
        try {
          params = JSON.parse(paramsMatch[1]);
        } catch {
          logger.error("[AiAgent] Failed to parse tool params from AI response");
          return;
        }
      }

      await executeTool(action, params, context.whatsappId);
    }
  } catch (err) {
    logger.error(`[AiAgent] Error in decideAndAct: ${err}`);
  }
};

const decideCronAction = async (
  job: CronJobContext,
  context: Awaited<ReturnType<typeof buildContext>>
): Promise<void> => {
  try {
    const apiKey = process.env.OPENCODE_API_KEY;
    const model = process.env.AI_MODEL || "deepseek-v4-flash";

    if (!apiKey) {
      logger.warn("[AiAgent] AI_API_KEY not configured, skipping cron action");
      return;
    }

    const rawCronJid = context.incomingMessage.fromJid;
    const displayCronJid = rawCronJid.includes("@") ? rawCronJid : `${rawCronJid}@s.whatsapp.net`;
    const cronGroupJidLine = context.incomingMessage.groupJid
      ? `JID del grupo: ${context.incomingMessage.groupJid}`
      : undefined;

    const systemPrompt = [
      "Eres un AI Agent ejecutando una tarea programada (cron job).",
      "",
      "=== JOB ===",
      `Nombre: ${job.jobName}`,
      `Tipo: ${job.actionType}`,
      `Config: ${job.config || "(ninguna)"}`,
      "",
      "=== CONTEXTO ===",
      `WhatsApp status: ${context.whatsappStatus}`,
      `Hora actual: ${context.currentTime}`,
    `Usuario que escribe: ${displayCronJid}`,
    `Es grupo: ${context.incomingMessage.isGroup ? "sí" : "no"}`,
    cronGroupJidLine,
      "",
      "=== INSTRUCCIONES ACTIVAS ===",
      context.activeInstructions.map(i => i.instruction).join("\n") || "(ninguna)",
      "",
      "=== FORMATO DE RESPUESTA ===",
      "Si decides ejecutar una acción, responde con:",
      "ACTION: send_text",
      "PARAMS: {\"toJid\": \"...\", \"body\": \"...\"}",
      "MESSAGE: <explicación>",
      "",
      "Si decides no hacer nada, responde con:",
      "ACTION: skip",
      "MESSAGE: <razón>"
    ].join("\n");

    const response = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Ejecutando cron job: ${job.jobName} (${job.actionType})`
          }
        ],
        temperature: 0.5,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `[AiAgent] OpenCode Go API error (cron): ${response.status} ${response.statusText} — ${errorBody}`
      );
      return;
    }

    const data = await response.json();
    const decision = data.choices?.[0]?.message?.content || "";

    logger.info(`[AiAgent] Cron decision for "${job.jobName}": ${decision}`);

    const actionMatch = decision.match(/ACTION:\s*(\w+)/);
    const paramsMatch = decision.match(/PARAMS:\s*(\{[\s\S]*?\})/);

    if (actionMatch) {
      const action = actionMatch[1];

      if (action === "skip") {
        logger.info(`[AiAgent] Cron skipped: ${decision}`);
        return;
      }

      if (!job.whatsappId) {
        logger.warn(`[AiAgent] Cron job "${job.jobName}" has no whatsappId, cannot execute`);
        return;
      }

      let params: Record<string, unknown> = {};
      if (paramsMatch) {
        try {
          params = JSON.parse(paramsMatch[1]);
        } catch {
          logger.error("[AiAgent] Failed to parse tool params from AI cron response");
          return;
        }
      }

      await executeTool(action, params, job.whatsappId);
    }
  } catch (err) {
    logger.error(`[AiAgent] Error in decideCronAction: ${err}`);
  }
};

export { decideAndAct, decideCronAction };
