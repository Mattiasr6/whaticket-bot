import AutoForward from "../../models/AutoForward";

const ListAutoForwardService = async (
  whatsappId?: number
): Promise<AutoForward[]> => {
  const filter = whatsappId ? { whatsappId } : undefined;
  const rules = await AutoForward.findAll({
    where: filter,
    order: [["createdAt", "DESC"]]
  });
  return rules;
};

export default ListAutoForwardService;
