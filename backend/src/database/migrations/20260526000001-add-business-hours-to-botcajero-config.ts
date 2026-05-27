import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroConfigs", "businessHours", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("BotCajeroConfigs", "businessHours");
  }
};
