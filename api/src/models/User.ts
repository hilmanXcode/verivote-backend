import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface UserAttributes {
  id: number;
  nim: string;
  name: string;
  password: string;
  role: "admin" | "user" | "operator";
  wallet_address: string | null;
  created_at: Date;
  updated_at: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, "id" | "wallet_address" | "created_at" | "updated_at"> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public nim!: string;
  public name!: string;
  public password!: string;
  public role!: "admin" | "user" | "operator";
  public wallet_address!: string | null;
  public created_at!: Date;
  public updated_at!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nim: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM("admin", "user", "operator"),
      defaultValue: "user",
      allowNull: false,
    },
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: true,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "users",
    modelName: "User",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default User;
