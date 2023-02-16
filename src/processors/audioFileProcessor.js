const { v4: uuidv4 } = require('uuid'); // for new audio clips
// to save audio files
const multer = require('multer'); // to process form-data
const storage = multer.diskStorage({
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const newACType = req.body.newACType === 'Visual' ? 'nonOCR' : 'OCR';
    cb(null, `${newACType}-${uniqueId}.mp3`);
  },
  destination: function (req, file, cb) {
    cb(null, `./public/audio/${req.body.youtubeVideoId}/${req.body.userId}`);
  },
  onError: function (err, next) {
    console.log('error', err);
    next(err);
  },
});
const upload = multer({ storage });

module.exports = upload;
