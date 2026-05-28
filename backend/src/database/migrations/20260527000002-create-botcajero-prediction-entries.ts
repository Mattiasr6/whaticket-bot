import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroPredictionEntries", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      predictionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "BotCajeroPredictions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      userJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      userLabel: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      prediction: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex("BotCajeroPredictionEntries", [
      "predictionId"
    ]);
  },

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("BotCajeroPredictionEntries")
};
