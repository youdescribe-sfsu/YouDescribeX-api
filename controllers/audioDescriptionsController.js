const Audio_Descriptions = require('../models/Audio_Descriptions');
const Audio_Clips = require('../models/Audio_Clips');
const Notes = require('../models/Notes');

const fs = require('fs');

// db processing is done here using sequelize models

// GET Routes
// get user Audio Description Data (including Notes, AudioClips) - based on UserId & VideoId
exports.getUserAudioDescriptionData = async (req, res) => {
  Audio_Descriptions.findOne({
    where: {
      VideoVideoId: req.params.videoId,
      UserUserId: req.params.userId,
    },
    // nesting Audio_Clips & Notes data too
    include: [
      {
        model: Audio_Clips,
        separate: true, // this is nested data, so ordering works only with separate true
        order: ['clip_start_time'],
      },
      {
        model: Notes,
      },
    ],
  })
    .then((data) => {
      // console.log(data);
      return res.send(data);
    })
    .catch((err) => {
      console.log(err);
    });
};

// DELETE ROUTES
// delete all audio files of a user-ad based on youtubeVideoId
// DEVELOPER ROUTE
exports.deleteUserADAudios = async (req, res) => {
  // res.send(req.params);
  const pathToFolder = `./public/audio/${req.params.youtubeVideoId}/${req.params.userId}`;
  fs.readdir(pathToFolder, (err, files) => {
    if (err) {
      console.log(err);
      res.status(500).send('Error Reading Folder. Please check later!');
    } else {
      // delete all files
      try {
        // let dataToSend = [{ totalFiles: files.length }];
        let dataToSend = [];
        files.forEach((file, i) => {
          fs.unlinkSync(pathToFolder + '/' + file);
          dataToSend.push({
            SerialNumber: i + 1,
            file: file,
            status: 'File Deleted Successfully.',
          });
        });
        res.status(200).send(dataToSend);
      } catch (err) {
        console.log(err);
        res.status(500).send('Error Deleting Files. Please check later!');
      }
    }
  });
};
