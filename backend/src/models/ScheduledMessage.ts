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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";

@Table
class ScheduledMessage extends Model<ScheduledMessage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Whatsapp)
  @AllowNull(false)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(false)
  @Column
  groupJid: string;

  @AllowNull(false)
  @Column
  groupName: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  messageText: string;

  @AllowNull(true)
  @Column
  mediaPath: string;

  @AllowNull(true)
  @Column
  mediaName: string;

  @Default(1440)
  @AllowNull(false)
  @Column
  intervalMinutes: number;

  @AllowNull(true)
  @Column
  lastSentAt: Date;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default ScheduledMessage;
