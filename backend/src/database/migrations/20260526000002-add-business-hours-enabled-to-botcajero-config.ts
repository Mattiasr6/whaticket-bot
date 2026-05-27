import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("BotCajeroConfigs", "businessHoursEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn(
      "BotCajeroConfigs",
      "businessHoursEnabled"
    );
  }
};
