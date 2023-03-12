import * as Sequelize from 'sequelize';
import { DataTypes, Model, Optional } from 'sequelize';
import { IUsers } from '../../interfaces/users.interface';
import type { Audio_Descriptions, Audio_DescriptionsId } from './Audio_Descriptions';

export type UsersPk = 'user_id';
export type UsersId = Users[UsersPk];
export type UsersOptionalAttributes = 'user_email' | 'createdAt' | 'updatedAt';
export type UsersCreationAttributes = Optional<IUsers, UsersOptionalAttributes>;

export class Users extends Model<IUsers, UsersCreationAttributes> implements IUsers {
  user_id!: string;
  is_ai!: boolean;
  name!: string;
  user_email?: string;
  createdAt!: Date;
  updatedAt!: Date;

  // Users hasMany Audio_Descriptions via UserUserId
  Audio_Descriptions!: Audio_Descriptions[];
  getAudio_Descriptions!: Sequelize.HasManyGetAssociationsMixin<Audio_Descriptions>;
  setAudio_Descriptions!: Sequelize.HasManySetAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  addAudio_Description!: Sequelize.HasManyAddAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  addAudio_Descriptions!: Sequelize.HasManyAddAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  createAudio_Description!: Sequelize.HasManyCreateAssociationMixin<Audio_Descriptions>;
  removeAudio_Description!: Sequelize.HasManyRemoveAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  removeAudio_Descriptions!: Sequelize.HasManyRemoveAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  hasAudio_Description!: Sequelize.HasManyHasAssociationMixin<Audio_Descriptions, Audio_DescriptionsId>;
  hasAudio_Descriptions!: Sequelize.HasManyHasAssociationsMixin<Audio_Descriptions, Audio_DescriptionsId>;
  countAudio_Descriptions!: Sequelize.HasManyCountAssociationsMixin;

  static initModel(sequelize: Sequelize.Sequelize): typeof Users {
    return Users.init(
      {
        user_id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false,
          primaryKey: true,
        },
        is_ai: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        user_email: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          defaultValue: Sequelize.NOW,
        },
      },
      {
        sequelize,
        tableName: 'Users',
        schema: 'public',
        timestamps: true,
        indexes: [
          {
            name: 'Users_pkey',
            unique: true,
            fields: [{ name: 'user_id' }],
          },
        ],
      },
    );
  }
}
