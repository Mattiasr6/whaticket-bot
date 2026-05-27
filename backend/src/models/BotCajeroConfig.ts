/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  Default,
  AllowNull,
  Unique,
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";
import BotCajeroFAQ from "./BotCajeroFAQ";
import BotCajeroSpamRule from "./BotCajeroSpamRule";
import BotCajeroSticker from "./BotCajeroSticker";
import BotCajeroLog from "./BotCajeroLog";

@Table
class BotCajeroConfig extends Model<BotCajeroConfig> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Whatsapp)
  @AllowNull(false)
  @Unique
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  groupJid: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  groupName: string;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  adminNumber: string;

  @Default(true)
  @AllowNull(false)
  @Column
  welcomeEnabled: boolean;

  @Default(true)
  @AllowNull(false)
  @Column
  farewellEnabled: boolean;

  @Default(true)
  @AllowNull(false)
  @Column
  autoReplyEnabled: boolean;

  @Default(true)
  @AllowNull(false)
  @Column
  antiSpamEnabled: boolean;

  @Default(false)
  @AllowNull(false)
  @Column
  quietModeEnabled: boolean;

  @Default("23:00")
  @AllowNull(false)
  @Column(DataType.STRING(5))
  quietModeStart: string;

  @Default("08:00")
  @AllowNull(false)
  @Column(DataType.STRING(5))
  quietModeEnd: string;

  @Default(24)
  @AllowNull(false)
  @Column
  inactivityHours: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  welcomeMessage: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  farewellMessage: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  rules: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  businessHours: string;

  @Default(true)
  @AllowNull(false)
  @Column
  businessHoursEnabled: boolean;

  @HasMany(() => BotCajeroFAQ)
  faqs: BotCajeroFAQ[];

  @HasMany(() => BotCajeroSpamRule)
  spamRules: BotCajeroSpamRule[];

  @HasMany(() => BotCajeroSticker)
  stickers: BotCajeroSticker[];

  @HasMany(() => BotCajeroLog)
  logs: BotCajeroLog[];

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default BotCajeroConfig;
