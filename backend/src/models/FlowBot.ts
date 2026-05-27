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
import FlowNode from "./FlowNode";
import FlowSession from "./FlowSession";

@Table
class FlowBot extends Model<FlowBot> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @ForeignKey(() => Whatsapp)
  @AllowNull(false)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @Default(false)
  @AllowNull(false)
  @Column
  enabled: boolean;

  @AllowNull(true)
  @Column(DataType.TEXT)
  triggerKeywords: string;

  @HasMany(() => FlowNode)
  flowNodes: FlowNode[];

  @HasMany(() => FlowSession)
  flowSessions: FlowSession[];

  @Column(DataType.VIRTUAL)
  nodesCount: number;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default FlowBot;
