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
  CreatedAt
} from "sequelize-typescript";
import BotCajeroPrediction from "./BotCajeroPrediction";

@Table
class BotCajeroPredictionEntry extends Model<BotCajeroPredictionEntry> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => BotCajeroPrediction)
  @AllowNull(false)
  @Column
  predictionId: number;

  @BelongsTo(() => BotCajeroPrediction)
  predictionRef: BotCajeroPrediction;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  prediction: string;

  @CreatedAt
  @Column
  createdAt: Date;
}

export default BotCajeroPredictionEntry;
