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
import FlowBot from "./FlowBot";
import FlowSession from "./FlowSession";

@Table
class FlowNode extends Model<FlowNode> {
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

  @ForeignKey(() => FlowNode)
  @AllowNull(true)
  @Column
  parentId: number;

  @BelongsTo(() => FlowNode, "parentId")
  parent: FlowNode;

  @HasMany(() => FlowNode, { foreignKey: "parentId" })
  children: FlowNode[];

  @AllowNull(false)
  @Column
  title: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  content: string;

  @AllowNull(false)
  @Default("message")
  @Column(DataType.ENUM("menu", "message", "redirect"))
  type: "menu" | "message" | "redirect";

  @ForeignKey(() => FlowNode)
  @AllowNull(true)
  @Column
  redirectToNodeId: number;

  @BelongsTo(() => FlowNode, "redirectToNodeId")
  redirectToNode: FlowNode;

  @Default(0)
  @AllowNull(false)
  @Column
  sortOrder: number;

  @HasMany(() => FlowSession)
  flowSessions: FlowSession[];

  @CreatedAt
  @Column
  createdAt: Date;

  @UpdatedAt
  @Column
  updatedAt: Date;
}

export default FlowNode;
