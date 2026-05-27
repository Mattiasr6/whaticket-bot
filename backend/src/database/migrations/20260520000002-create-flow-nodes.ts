import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("FlowNodes", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      flowBotId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "FlowBots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "FlowNodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      type: {
        type: DataTypes.ENUM("menu", "message", "redirect"),
        allowNull: false,
        defaultValue: "message"
      },
      redirectToNodeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "FlowNodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("FlowNodes", ["flowBotId", "parentId"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FlowNodes");
  }
};
