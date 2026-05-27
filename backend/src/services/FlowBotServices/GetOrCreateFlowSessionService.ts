import FlowSession from "../../models/FlowSession";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

interface Request {
  flowBotId: number;
  contactJid: string;
}

const GetOrCreateFlowSessionService = async (
  data: Request,
  existingSession?: FlowSession | null
): Promise<FlowSession> => {
  let session: FlowSession | null =
    existingSession !== undefined ? existingSession : null;

  if (!session) {
    session = await FlowSession.findOne({
      where: {
        flowBotId: data.flowBotId,
        contactJid: data.contactJid
      }
    });
  }

  if (session) {
    const now = new Date();
    const elapsed = now.getTime() - session.updatedAt.getTime();
    if (elapsed > SESSION_TIMEOUT_MS) {
      session.currentNodeId = null;
      await session.save();
    }
    return session;
  }

  session = await FlowSession.create({
    flowBotId: data.flowBotId,
    contactJid: data.contactJid,
    currentNodeId: null
  });

  return session;
};

export default GetOrCreateFlowSessionService;
