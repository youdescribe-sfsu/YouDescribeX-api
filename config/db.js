const { Sequelize, UUID } = require('sequelize');
const mongoose = require('mongoose');
const mongoDb = mongoose.connect(`mongodb://localhost:27017`, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log(`Connected to MONGODB!`))
  .catch(error => console.log(error.message));


const db = new Sequelize(
  process.env.DATABASE,
  process.env.UNAME,
  process.env.DBPASSWORD,
  {
    host: process.env.HOST,
    port: process.env.DBPORT,
    dialect: 'postgres',
  }
);
console.log('-----------------');
console.log(db)

// Test DB connection
db.authenticate()
  .then(() => console.log('Connected to YDXAI Database'))
  .then(() => {
    // db.sync({ alter: true })
    db.sync({ logging: false })
      .then((result) => {
        // console.log(result);
      })
      .catch((err) => {
        console.log(err);
      });
  })
  .catch((err) => console.log('Error' + err));




module.exports = { db, mongoDb };
