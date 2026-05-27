import AutoForward from "../../models/AutoForward";
import AppError from "../../errors/AppError";

const ToggleAutoForwardService = async (id: number): Promise<AutoForward> => {
  const rule = await AutoForward.findByPk(id);
  if (!rule) throw new AppError("AutoForward rule not found");
  await rule.update({ enabled: !rule.enabled });
  return rule;
};

export default ToggleAutoForwardService;
