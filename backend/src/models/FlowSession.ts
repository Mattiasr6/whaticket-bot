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
  AllowNull,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import FlowBot from "./FlowBot";
import FlowNode from "./FlowNode";

@Table
class FlowSession extends Model<FlowSession> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => FlowBot)
  @AllowNull(false)
  @Column
  flowBotId: number;

  @BelongsTo(() => FlowBot)
  flowBot: FlowBot;

  @AllowNull(false)
  @Column(DataType.STRING(255))
  contactJid: string;

  @ForeignKey(() => FlowNode)
  @AllowNull(true)
  @Column(DataType.INTEGER)
  currentNodeId: number | null;

  @BelongsTo(() => FlowNode)
  currentNode: FlowNode;

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default FlowSession;
