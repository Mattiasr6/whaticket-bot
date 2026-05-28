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
  UpdatedAt,
  HasMany
} from "sequelize-typescript";
import BotCajeroConfig from "./BotCajeroConfig";
import BotCajeroPredictionEntry from "./BotCajeroPredictionEntry";

@Table
class BotCajeroPrediction extends Model<BotCajeroPrediction> {
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
  fixtureId: number;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  matchLabel: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  matchTime: Date;

  @AllowNull(false)
  @Column(
    DataType.ENUM(
      "score_exacto",
      "goles_totales",
      "primer_gol",
      "esquinas_totales",
      "goles_primer_tiempo"
    )
  )
  predictionType: string;

  @Default("abierta")
  @AllowNull(false)
  @Column(DataType.ENUM("abierta", "cerrada", "resuelta"))
  status: string;

  @AllowNull(true)
  @Column(DataType.STRING(100))
  result: string;

  @HasMany(() => BotCajeroPredictionEntry)
  entries: BotCajeroPredictionEntry[];

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default BotCajeroPrediction;
