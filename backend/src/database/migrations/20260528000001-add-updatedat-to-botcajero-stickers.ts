import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroStickers", "updatedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("BotCajeroStickers", "updatedAt");
  }
};
