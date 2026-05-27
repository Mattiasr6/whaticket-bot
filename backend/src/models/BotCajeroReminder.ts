/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
  Default,
  CreatedAt,
  UpdatedAt
} from "sequelize-typescript";
import BotCajeroConfig from "./BotCajeroConfig";

@Table
class BotCajeroReminder extends Model<BotCajeroReminder> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => BotCajeroConfig)
  @AllowNull(false)
  @Column
  botCajeroConfigId: number;

  @BelongsTo(() => BotCajeroConfig)
  config: BotCajeroConfig;

  @AllowNull(false)
  @Column
  whatsappId: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  groupJid: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  message: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  scheduledAt: Date;

  @AllowNull(true)
  @Column(DataType.DATE)
  sentAt: Date;

  @Default("pending")
  @AllowNull(false)
  @Column(DataType.ENUM("pending", "sent", "cancelled"))
  status: string;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default BotCajeroReminder;
