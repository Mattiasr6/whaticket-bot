/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Table,
  Column,
  CreatedAt,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import BotCajeroConfig from "./BotCajeroConfig";

@Table
class BotCajeroSticker extends Model<BotCajeroSticker> {
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
  @Column(DataType.STRING(500))
  mediaPath: string;

  @AllowNull(true)
  @Column(DataType.STRING(255))
  mediaName: string;

  @CreatedAt
  @Column
  createdAt: Date;
}

export default BotCajeroSticker;
