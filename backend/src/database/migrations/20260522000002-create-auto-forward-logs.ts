import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutoForwardLogs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      autoForwardId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "AutoForwards", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      adminNumber: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      imageCount: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM("success", "no_images", "cancelled", "error"),
        allowNull: false
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      executedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    await queryInterface.addIndex("AutoForwardLogs", ["autoForwardId"]);
    await queryInterface.addIndex("AutoForwardLogs", ["executedAt"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("AutoForwardLogs");
  }
};
