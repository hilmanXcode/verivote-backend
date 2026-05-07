import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

interface AnnouncementAttributes {
  id: number;
  title: string;
  content: string;
  priority: "normal" | "important" | "urgent";
  created_by: string;
  author_name: string;
  created_at: Date;
  updated_at: Date;
}

interface AnnouncementCreationAttributes extends Optional<AnnouncementAttributes, "id" | "created_at" | "updated_at"> {}

class Announcement extends Model<AnnouncementAttributes, AnnouncementCreationAttributes> implements AnnouncementAttributes {
  public id!: number;
  public title!: string;
  public content!: string;
  public priority!: "normal" | "important" | "urgent";
  public created_by!: string;
  public author_name!: string;
  public created_at!: Date;
  public updated_at!: Date;
}

Announcement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    priority: {
      type: DataTypes.ENUM("normal", "important", "urgent"),
      defaultValue: "normal",
      allowNull: false,
    },
    created_by: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    author_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
    tableName: "announcements",
    modelName: "Announcement",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default Announcement;
