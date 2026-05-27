import BotRule from "../../models/BotRule";
import AppError from "../../errors/AppError";

const DeleteBotRuleService = async (id: number) => {
  const rule = await BotRule.findByPk(id);
  if (!rule) throw new AppError("Bot rule not found");
  await rule.destroy();
};

export default DeleteBotRuleService;
