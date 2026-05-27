import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import QuickAnswer from "../models/QuickAnswer";
import WppKey from "../models/WppKey";
import ScheduledMessage from "../models/ScheduledMessage";
import BotRule from "../models/BotRule";
import CronJob from "../models/CronJob";
import AgentInstruction from "../models/AgentInstruction";
import FlowBot from "../models/FlowBot";
import FlowNode from "../models/FlowNode";
import FlowSession from "../models/FlowSession";
import AutoForward from "../models/AutoForward";
import AutoForwardLog from "../models/AutoForwardLog";
import BotCajeroConfig from "../models/BotCajeroConfig";
import BotCajeroFAQ from "../models/BotCajeroFAQ";
import BotCajeroSpamRule from "../models/BotCajeroSpamRule";
import BotCajeroSticker from "../models/BotCajeroSticker";
import BotCajeroLog from "../models/BotCajeroLog";
import BotCajeroReminder from "../models/BotCajeroReminder";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  WppKey,
  ScheduledMessage,
  BotRule,
  CronJob,
  AgentInstruction,
  FlowBot,
  FlowNode,
  FlowSession,
  AutoForward,
  AutoForwardLog,
  BotCajeroConfig,
  BotCajeroFAQ,
  BotCajeroSpamRule,
  BotCajeroSticker,
  BotCajeroLog,
  BotCajeroReminder
];

sequelize.addModels(models);

export default sequelize;
