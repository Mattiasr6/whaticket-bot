import BotRule from "../../models/BotRule";

interface Request {
  whatsappId: number;
  name: string;
  keywords: string;
  matchType: string;
  response?: string;
  mediaPath?: string;
  mediaName?: string;
  scope: string;
  groupJid?: string;
  enabled?: boolean;
  priority?: number;
}

const CreateBotRuleService = async (data: Request) => {
  const rule = await BotRule.create(data);
  return rule;
};

export default CreateBotRuleService;
