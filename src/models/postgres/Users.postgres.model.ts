import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { IUsers } from '../../interfaces/users.interface';
import { ObjectId } from 'mongoose';


class Users extends Model<IUsers> implements IUsers {
  user_id!: ObjectId;
  is_ai!: boolean;
  name!: string;
  user_email!: string;
}

// Define the User model and export it
function initUsersModel(sequelize: Sequelize) {
  Users.init(
    {
      user_id: {
        type: DataTypes.UUIDV4,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      is_ai: {
        allowNull: false,
        type: DataTypes.BOOLEAN,
      },
      name: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      user_email: {
        allowNull: true,
        type: DataTypes.STRING,
      },
    },
    {
      sequelize,
      modelName: 'Users',
    },
  );

  return Users
}

export const UsersSchema = initUsersModel(getPostGresConnection());


// const { UUIDV4 } = require('sequelize');
// const Sequelize = require('sequelize');
// const db = require('../config/db');

// const Users = db.define('Users', {
//   user_id: {
//     type: Sequelize.UUID,
//     defaultValue: UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   is_ai: {
//     allowNull: false,
//     type: Sequelize.BOOLEAN,
//   },
//   name: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   user_email: {
//     allowNull: true,
//     type: Sequelize.STRING,
//   },
// });

// module.exports = Users;
