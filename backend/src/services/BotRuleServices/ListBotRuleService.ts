import BotRule from "../../models/BotRule";

const ListBotRuleService = async (whatsappId?: number) => {
  const filter = whatsappId ? { whatsappId } : undefined;
  const rules = await BotRule.findAll({
    where: filter,
    order: [["priority", "ASC"]]
  });
  return rules;
};

export default ListBotRuleService;
