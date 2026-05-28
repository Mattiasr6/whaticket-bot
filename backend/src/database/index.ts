import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Whatsapp from "../models/Whatsapp";
import WppKey from "../models/WppKey";
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
import BotCajeroPrediction from "../models/BotCajeroPrediction";
import BotCajeroPredictionEntry from "../models/BotCajeroPredictionEntry";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  Whatsapp,
  Setting,
  WppKey,
  CronJob,
  AgentInstruction,
  FlowBot,
  FlowNode,
  FlowSession,
  AutoForward,
  AutoForwardLog,
  BotCajeroConfig,
  BotCajeroFAQ,
  BotCajeroPrediction,
  BotCajeroPredictionEntry,
  BotCajeroSpamRule,
  BotCajeroSticker,
  BotCajeroLog,
  BotCajeroReminder
];

sequelize.addModels(models);

export default sequelize;
