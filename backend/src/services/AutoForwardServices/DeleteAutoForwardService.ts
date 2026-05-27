import AutoForward from "../../models/AutoForward";
import AppError from "../../errors/AppError";

const DeleteAutoForwardService = async (id: number): Promise<void> => {
  const rule = await AutoForward.findByPk(id);
  if (!rule) throw new AppError("AutoForward rule not found");
  await rule.destroy();
};

export default DeleteAutoForwardService;
