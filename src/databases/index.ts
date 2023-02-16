// Import configuration variables
import { MONGO_DB_DATABASE, MONGO_DB_HOST, MONGO_DB_PORT } from '../config';
import { POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRES_DB_HOST, POSTGRES_DB_PORT } from '../config';

// Import database libraries
import { connect } from 'mongoose';
import { Sequelize, Options } from 'sequelize';

import { CURRENT_DATABASE } from '../config';
// MongoDB connection string
const MONGODB_CONNECTION_STRING = `mongodb://${MONGO_DB_HOST}:${MONGO_DB_PORT}/${MONGO_DB_DATABASE}`;
console.log(MONGODB_CONNECTION_STRING)
// PostgreSQL connection object
const POSTGRESQL_OPTIONS: Options = {
    host: POSTGRES_DB_HOST,
    port: parseInt(POSTGRES_DB_PORT) || 5432,
    dialect: 'postgres',
};


// PostgreSQL connection object
const POSTGRESQL_CONNECTION: Sequelize = new Sequelize(POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRESQL_OPTIONS);

/**
 * Returns a MongoDB connection instance
A Promise that resolves to a MongoDB connection instance
*/
export const getMongoDbConnection = (): Promise<typeof import("mongoose")> => connect(MONGODB_CONNECTION_STRING);

/**
 * Returns a PostgreSQL connection instance
 * @returns {Sequelize} - A Sequelize connection instance for PostgreSQL
 */
export const getPostGresConnection = (): Sequelize => POSTGRESQL_CONNECTION;

export const testDataBaseConnection = () => {
    if (CURRENT_DATABASE === 'mongodb') {
        console.log("Testing MongoDB connection")
        getMongoDbConnection().then((result) => {
            console.log(`Connected to MongoDB Database: ${result.connection.name}`)
        }).catch((err) => {
            console.log(`Error connecting to MongoDB Database: ${err}`)
        });
    } else {
        console.log("Testing PostgreSQL connection")
        getPostGresConnection().authenticate()
            .then(() => console.log(`Connected to ${POSTGRES_DB_NAME} Database`))
            .then(() => {
                // db.sync({ alter: true })
                POSTGRESQL_CONNECTION.sync({ logging: false })
                    .then((result) => {
                        console.log(`Synced with YDXAI Database}`);
                    })
                    .catch((err) => {
                        console.log(err);
                    });
            })
            .catch((err) => console.log(`Error connecting to YDXAI Database: ${err}`));
    }
}