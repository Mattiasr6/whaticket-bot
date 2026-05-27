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
  ForeignKey,
  BelongsTo,
  HasMany
} from "sequelize-typescript";
import Whatsapp from "./Whatsapp";
import AutoForwardLog from "./AutoForwardLog";

@Table
class AutoForward extends Model<AutoForward> {
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
  @Column(DataType.STRING(100))
  name: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  sourceGroupJid: string;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  targetGroupJid: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  adminNumbers: string;

  @Default(10)
  @AllowNull(false)
  @Column
  timeWindowMinutes: number;

  @Default(50)
  @AllowNull(false)
  @Column
  maxLookback: number;

  @Default(15)
  @AllowNull(false)
  @Column
  maxForward: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  customCaption: string;

  @Default(4000)
  @AllowNull(false)
  @Column
  delayBetweenMs: number;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @HasMany(() => AutoForwardLog)
  logs: AutoForwardLog[];

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default AutoForward;
