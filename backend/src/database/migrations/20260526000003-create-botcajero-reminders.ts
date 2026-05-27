import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroReminders", {
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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      groupJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM("pending", "sent", "cancelled"),
        allowNull: false,
        defaultValue: "pending"
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

    await queryInterface.addIndex("BotCajeroReminders", [
      "status",
      "scheduledAt"
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroReminders");
  }
};
