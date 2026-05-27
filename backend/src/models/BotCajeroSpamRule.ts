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
class BotCajeroSpamRule extends Model<BotCajeroSpamRule> {
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
  @Column(DataType.STRING)
  type: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  pattern: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  action: string;

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

export default BotCajeroSpamRule;
