import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroLogs", "updatedAt", {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    });
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("BotCajeroLogs", "updatedAt");
  }
};
