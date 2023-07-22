// Import configuration variables
import { MONGO_DB_DATABASE, MONGO_DB_HOST, MONGO_DB_PORT, MONGO_DB_USER, MONGO_DB_PASSWORD, NODE_ENV } from '../config';
import { POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRES_DB_HOST, POSTGRES_DB_PORT } from '../config';

// Import database libraries
import mongoose, { connect } from 'mongoose';
import { Sequelize, Options } from 'sequelize';

import { CURRENT_DATABASE } from '../config';
import { logger } from '../utils/logger';
// MongoDB connection string
const MONGODB_CONNECTION_STRING =
  NODE_ENV === 'production'
    ? `mongodb://${MONGO_DB_USER}:${MONGO_DB_PASSWORD}@${MONGO_DB_HOST}:${MONGO_DB_PORT}/${MONGO_DB_DATABASE}`
    : `mongodb://${MONGO_DB_HOST}:${MONGO_DB_PORT}/${MONGO_DB_DATABASE}`;

    logger.info(`NODE`)
    logger.info(process.env)
logger.info(`MONGODB_CONNECTION_STRING: ${MONGODB_CONNECTION_STRING}`);

// PostgreSQL connection object
const POSTGRESQL_OPTIONS: Options = {
  host: POSTGRES_DB_HOST,
  port: parseInt(POSTGRES_DB_PORT) || 5432,
  dialect: 'postgres',
  logging: false,
};

// PostgreSQL connection object
const POSTGRESQL_CONNECTION: Sequelize = new Sequelize(POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRESQL_OPTIONS);

/**
 * Returns a MongoDB connection instance
A Promise that resolves to a MongoDB connection instance
*/
export const getMongoDbConnection = (): Promise<typeof import('mongoose')> => connect(MONGODB_CONNECTION_STRING);

/**
 * Returns a PostgreSQL connection instance
 * @returns {Sequelize} - A Sequelize connection instance for PostgreSQL
 */
export const getPostGresConnection = (): Sequelize => POSTGRESQL_CONNECTION;

export const testDataBaseConnection = () => {
  if (CURRENT_DATABASE === 'mongodb') {
    logger.info('Testing MongoDB connection');
    getMongoDbConnection()
      .then(result => {
        logger.info(`Connected to MongoDB Database: ${result.connection.name}`);
      })
      .catch(err => {
        logger.info(`Error connecting to MongoDB Database: ${err}`);
      });
  } else {
    logger.info('Testing PostgreSQL connection');
    getPostGresConnection()
      .authenticate()
      .then(() => logger.info(`Connected to ${POSTGRES_DB_NAME} Database`))
      .then(() => {
        // db.sync({ alter: true })
        POSTGRESQL_CONNECTION.sync({ logging: false })
          .then(() => {
            logger.info(`Synced with ${POSTGRES_DB_NAME} Database`);
          })
          .catch(err => {
            logger.info(err);
          });
      })
      .catch(err => logger.info(`Error connecting to YDXAI Database: ${err}`));
  }
};
