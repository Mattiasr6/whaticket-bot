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
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import AutoForward from "./AutoForward";

@Table
class AutoForwardLog extends Model<AutoForwardLog> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => AutoForward)
  @AllowNull(false)
  @Column
  autoForwardId: number;

  @BelongsTo(() => AutoForward)
  autoForward: AutoForward;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  adminNumber: string;

  @AllowNull(false)
  @Column
  imageCount: number;

  @AllowNull(false)
  @Column(DataType.ENUM("success", "no_images", "cancelled", "error"))
  status: "success" | "no_images" | "cancelled" | "error";

  @AllowNull(true)
  @Column(DataType.TEXT)
  errorMessage: string;

  @CreatedAt
  @AllowNull(false)
  @Column(DataType.DATE)
  executedAt: Date;
}

export default AutoForwardLog;
