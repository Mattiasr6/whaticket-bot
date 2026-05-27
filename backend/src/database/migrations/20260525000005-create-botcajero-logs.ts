import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      botCajeroConfigId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "BotCajeroConfigs", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      eventType: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      detail: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("BotCajeroLogs", ["botCajeroConfigId", "eventType"]);
    await queryInterface.addIndex("BotCajeroLogs", ["createdAt"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroLogs");
  }
};
