/* eslint-disable no-await-in-loop, no-restricted-syntax, no-plusplus */
import { Op } from "sequelize";
import FlowSession from "../../models/FlowSession";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const ExpireFlowSessionService = async (
  sessionId?: number
): Promise<number> => {
  if (sessionId !== undefined) {
    const session = await FlowSession.findByPk(sessionId);
    if (session && session.currentNodeId !== null) {
      session.currentNodeId = null;
      await session.save();
      return 1;
    }
    return 0;
  }

  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS);
  const allSessions = await FlowSession.findAll({
    where: {
      updatedAt: { [Op.lt]: cutoff }
    }
  });

  let expiredCount = 0;
  for (const session of allSessions) {
    if (session.currentNodeId !== null) {
      session.currentNodeId = null;
      await session.save();
      expiredCount++;
    }
  }

  return expiredCount;
};

export default ExpireFlowSessionService;
