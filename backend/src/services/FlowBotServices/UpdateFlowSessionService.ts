import FlowSession from "../../models/FlowSession";
import AppError from "../../errors/AppError";

interface Request {
  sessionId: number;
  currentNodeId: number | null;
}

const UpdateFlowSessionService = async (
  data: Request
): Promise<FlowSession> => {
  const session = await FlowSession.findByPk(data.sessionId);
  if (!session) throw new AppError("FlowSession not found");
  session.currentNodeId = data.currentNodeId;
  await session.save();
  return session;
};

export default UpdateFlowSessionService;
