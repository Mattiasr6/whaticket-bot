/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import BotCajeroConfig from "./BotCajeroConfig";

@Table
class BotCajeroLog extends Model<BotCajeroLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => BotCajeroConfig)
  @AllowNull(false)
  @Column
  botCajeroConfigId: number;

  @BelongsTo(() => BotCajeroConfig)
  botCajeroConfig: BotCajeroConfig;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  eventType: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  detail: string;

  @CreatedAt
  @AllowNull(false)
  @Column(DataType.DATE)
  createdAt: Date;

  @UpdatedAt
  @AllowNull(false)
  @Column(DataType.DATE)
  updatedAt: Date;
}

export default BotCajeroLog;
