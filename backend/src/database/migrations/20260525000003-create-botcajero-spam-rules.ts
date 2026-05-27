import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroSpamRules", {
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
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      pattern: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      action: {
        type: DataTypes.STRING,
        allowNull: false
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex("BotCajeroSpamRules", ["botCajeroConfigId"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroSpamRules");
  }
};
