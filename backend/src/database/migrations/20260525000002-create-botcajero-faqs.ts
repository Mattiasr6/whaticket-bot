import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroFAQs", {
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
      keywords: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      response: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      matchType: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "contains"
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      priority: {
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

    await queryInterface.addIndex("BotCajeroFAQs", ["botCajeroConfigId"]);
    await queryInterface.addIndex("BotCajeroFAQs", ["enabled", "priority"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroFAQs");
  }
};
