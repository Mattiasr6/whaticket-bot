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
  BelongsTo
} from "sequelize-typescript";
import BotCajeroConfig from "./BotCajeroConfig";

@Table
class BotCajeroFAQ extends Model<BotCajeroFAQ> {
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
  @Column(DataType.TEXT)
  keywords: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  response: string;

  @Default("contains")
  @AllowNull(true)
  @Column(DataType.STRING)
  matchType: string;

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

export default BotCajeroFAQ;
