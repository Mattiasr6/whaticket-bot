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
class CronJob extends Model<CronJob> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Column
  actionType: string;

  @AllowNull(false)
  @Column
  cronExpr: string;

  @ForeignKey(() => Whatsapp)
  @AllowNull(true)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @AllowNull(true)
  @Column(DataType.TEXT)
  config: string;

  @Default(true)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @AllowNull(true)
  @Column
  lastRunAt: Date;

  @AllowNull(true)
  @Column
  nextRunAt: Date;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default CronJob;
