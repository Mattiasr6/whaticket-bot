import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex("Messages", ["ticketId"], {
      name: "messages_ticket_id"
    });

    await queryInterface.addIndex("Tickets", ["status", "userId"], {
      name: "tickets_status_user"
    });

    await queryInterface.addIndex("BotRules", ["whatsappId", "enabled"], {
      name: "bot_rules_whatsapp_enabled"
    });

    await queryInterface.addIndex("CronJobs", ["whatsappId", "enabled"], {
      name: "cron_jobs_whatsapp_enabled"
    });

    await queryInterface.addIndex("AgentInstructions", ["whatsappId", "enabled"], {
      name: "agent_instructions_whatsapp"
    });

    await queryInterface.addIndex("Contacts", ["number", "isGroup"], {
      name: "contacts_whatsapp_number"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Messages", "messages_ticket_id");
    await queryInterface.removeIndex("Tickets", "tickets_status_user");
    await queryInterface.removeIndex("BotRules", "bot_rules_whatsapp_enabled");
    await queryInterface.removeIndex("CronJobs", "cron_jobs_whatsapp_enabled");
    await queryInterface.removeIndex("AgentInstructions", "agent_instructions_whatsapp");
    await queryInterface.removeIndex("Contacts", "contacts_whatsapp_number");
  }
};
