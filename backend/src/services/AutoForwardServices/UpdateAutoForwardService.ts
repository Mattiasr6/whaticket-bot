import AutoForward from "../../models/AutoForward";
import AppError from "../../errors/AppError";

const UpdateAutoForwardService = async (
  id: number,
  data: Partial<AutoForward>
): Promise<AutoForward> => {
  const rule = await AutoForward.findByPk(id);
  if (!rule) throw new AppError("AutoForward rule not found");

  if (data.name && data.name !== rule.name) {
    const existing = await AutoForward.findOne({
      where: { name: data.name }
    });
    if (existing) {
      throw new AppError("A rule with this name already exists");
    }
  }

  await rule.update(data);
  return rule;
};

export default UpdateAutoForwardService;
