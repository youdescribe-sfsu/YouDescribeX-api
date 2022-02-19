const { Sequelize } = require('sequelize');

const db = new Sequelize('YDXAI', 'postgres', 'password', {
  host: 'localhost',
  dialect: 'postgres',
});

module.exports = db;
