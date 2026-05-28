import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroPredictions", {
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
      fixtureId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      matchLabel: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      matchTime: {
        type: DataTypes.DATE,
        allowNull: false
      },
      predictionType: {
        type: DataTypes.ENUM(
          "score_exacto",
          "goles_totales",
          "primer_gol",
          "esquinas_totales",
          "goles_primer_tiempo"
        ),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM("abierta", "cerrada", "resuelta"),
        allowNull: false,
        defaultValue: "abierta"
      },
      result: {
        type: DataTypes.STRING(100),
        allowNull: true
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

    await queryInterface.addIndex("BotCajeroPredictions", [
      "botCajeroConfigId",
      "status"
    ]);
    await queryInterface.addIndex("BotCajeroPredictions", ["fixtureId"]);
  },

  down: (queryInterface: QueryInterface) =>
    queryInterface.dropTable("BotCajeroPredictions")
};
