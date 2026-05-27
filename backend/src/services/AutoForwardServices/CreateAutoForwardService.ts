import AutoForward from "../../models/AutoForward";
import AppError from "../../errors/AppError";

interface CreateAutoForwardData {
  whatsappId: number;
  name: string;
  sourceGroupJid: string;
  targetGroupJid: string;
  adminNumbers: string;
  timeWindowMinutes?: number;
  maxLookback?: number;
  maxForward?: number;
  customCaption?: string;
  delayBetweenMs?: number;
  enabled?: boolean;
}

const CreateAutoForwardService = async (
  data: CreateAutoForwardData
): Promise<AutoForward> => {
  if (data.sourceGroupJid === data.targetGroupJid) {
    throw new AppError("Source and target groups must be different");
  }

  const existing = await AutoForward.findOne({ where: { name: data.name } });
  if (existing) {
    throw new AppError("A rule with this name already exists");
  }

  // Normalize admin numbers: only digits, one per line
  const normalizedAdminNumbers = data.adminNumbers
    .split("\n")
    .map(line => line.replace(/\D/g, ""))
    .filter(Boolean)
    .join("\n");

  const rule = await AutoForward.create({
    ...data,
    adminNumbers: normalizedAdminNumbers
  });
  return rule;
};

export default CreateAutoForwardService;
