const express = require('express');
const cors = require('cors');
//routes
const users = require('./routes/users');
const videos = require('./routes/videos');
const dialog_timestamps = require('./routes/dialog_timestamps');
const audio_descriptions = require('./routes/audio_descriptions');
const notes = require('./routes/notes');
const audio_clips = require('./routes/audio_clips');

//database
const db = require('./config/db.js');

// Test DB connection
db.authenticate()
  .then(() => console.log('Connected to YDXAI Database'))
  .catch((err) => console.log('Error' + err));

const app = express();
app.use(cors());
app.use(express.json());

db.sync({ force: true })
  // db.sync()
  .then((result) => {
    console.log(result);
  })
  .catch((err) => {
    console.log(err);
  });

port = 4000;

//User Routes
app.use('/api/users', users);
app.use('/api/videos', videos);
app.use('/api/dialog_timestamps', dialog_timestamps);
app.use('/api/audio_descriptions', audio_descriptions);
app.use('/api/notes', notes);
app.use('/api/audio_clips', audio_clips);
app.listen(port, () => console.log(`YDX Backend server on port ${port}!`));
