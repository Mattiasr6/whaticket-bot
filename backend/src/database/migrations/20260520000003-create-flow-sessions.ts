import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("FlowSessions", {
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
      contactJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      currentNodeId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "FlowNodes", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
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

    await queryInterface.addIndex("FlowSessions", ["contactJid"]);
    await queryInterface.sequelize.query(
      "ALTER TABLE FlowSessions ADD CONSTRAINT uq_flow_sessions_bot_contact UNIQUE (flowBotId, contactJid)"
    );
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("FlowSessions");
  }
};
