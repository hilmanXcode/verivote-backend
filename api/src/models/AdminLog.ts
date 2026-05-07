import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface AdminLogAttributes {
  id: number;
  date: string;
  message: string;
  created_at: Date;
}

interface AdminLogCreationAttributes extends Optional<AdminLogAttributes, "id" | "date" | "created_at"> {}

class AdminLog extends Model<AdminLogAttributes, AdminLogCreationAttributes> implements AdminLogAttributes {
  public id!: number;
  public date!: string;
  public message!: string;
  public created_at!: Date;
}

AdminLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "admin_logs",
    modelName: "AdminLog",
    timestamps: false,
  }
);

export default AdminLog;
