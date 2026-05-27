import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("AutoForwards", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      sourceGroupJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      targetGroupJid: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      adminNumbers: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      timeWindowMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10
      },
      maxLookback: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50
      },
      maxForward: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 15
      },
      customCaption: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      delayBetweenMs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 4000
      },
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex("AutoForwards", ["whatsappId"]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.dropTable("AutoForwards");
  }
};
