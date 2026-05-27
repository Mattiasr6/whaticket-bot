import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroStickers", {
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
      mediaPath: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      mediaName: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("BotCajeroStickers", ["botCajeroConfigId"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroStickers");
  }
};
