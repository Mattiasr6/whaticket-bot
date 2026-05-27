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
class BotRule extends Model<BotRule> {
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
  name: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  keywords: string;

  @Default("contains")
  @AllowNull(false)
  @Column
  matchType: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  response: string;

  @AllowNull(true)
  @Column
  mediaPath: string;

  @AllowNull(true)
  @Column
  mediaName: string;

  @Default("all")
  @AllowNull(false)
  @Column
  scope: string;

  @AllowNull(true)
  @Column
  groupJid: string;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @Default(0)
  @AllowNull(false)
  @Column
  priority: number;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default BotRule;
