import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("BotCajeroConfigs", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      groupJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      groupName: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      adminNumber: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      welcomeEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      farewellEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      autoReplyEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      antiSpamEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      quietModeEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      quietModeStart: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "23:00"
      },
      quietModeEnd: {
        type: DataTypes.STRING(5),
        allowNull: false,
        defaultValue: "08:00"
      },
      inactivityHours: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 24
      },
      welcomeMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      farewellMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      rules: {
        type: DataTypes.TEXT,
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

    await queryInterface.addIndex("BotCajeroConfigs", ["groupJid"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("BotCajeroConfigs");
  }
};
