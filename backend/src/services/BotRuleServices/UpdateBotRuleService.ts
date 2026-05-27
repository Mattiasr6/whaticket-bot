import BotRule from "../../models/BotRule";
import AppError from "../../errors/AppError";

const UpdateBotRuleService = async (id: number, data: Partial<BotRule>) => {
  const rule = await BotRule.findByPk(id);
  if (!rule) throw new AppError("Bot rule not found");
  await rule.update(data);
  return rule;
};

export default UpdateBotRuleService;
