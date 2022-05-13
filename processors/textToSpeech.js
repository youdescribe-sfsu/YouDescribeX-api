// import uuid and generate unique/random id to inject in the audioname path
const { v4: uuidv4 } = require('uuid');
// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech');
// dot env
require('dotenv').config();
// Import other required libraries
const fs = require('fs');
const util = require('util');

// Creates a client
const client = new textToSpeech.TextToSpeechClient();

const generateMp3forDescriptionText = async (
  userId,
  youtubeVideoId,
  clipDescriptionText,
  clipDescriptionType
) => {
  try {
    // generate a unique ID
    const uniqueId = uuidv4();
    // assign female/male voice types based on description type
    // OCR => Female, NON OCR => Male
    clipDescriptionType === 'Visual'
      ? (voiceName = 'en-US-Wavenet-D') // Male
      : (voiceName = 'en-US-Wavenet-C'); // Female

    // Construct the request
    const request = {
      input: { text: clipDescriptionText },
      // Select the language and SSML voice gender (optional)
      voice: {
        languageCode: 'en-US',
        name: voiceName,
        ssmlGender: 'NEUTRAL',
      },
      // select the type of audio encoding
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.5 },
    };
    // Performs the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);

    // add a folder for video ID and a sub folder for user ID
    const dir = `./public/audio/${youtubeVideoId}/${userId}`;
    // creates the folder structure if it doesn't exist -- ${youtubeVideoId}/${userId}
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // write the audio file only if the directory exists/created
    if (fs.existsSync(dir)) {
      // store a variable ocr to add to the path of the audio file
      clipDescriptionType === 'Visual' ? (type = 'nonOCR') : (type = 'OCR');
      const filepath = `${dir}/${type}-${uniqueId}.mp3`;
      // Write the binary audio content to a local file
      const writeFile = util.promisify(fs.writeFile);
      await writeFile(filepath, response.audioContent, 'binary');
      console.log('Converted Text to Speech');
      // store a variable ocr to add to the path of the audio file
      // adding this again, because value is not updating for all audio files - TODO
      clipDescriptionType === 'Visual' ? (type = 'nonOCR') : (type = 'OCR');
      // remove public from the file path
      const servingFilepath = `./audio/${youtubeVideoId}/${userId}/${type}-${uniqueId}.mp3`;
      return { status: true, filepath: servingFilepath };
    }
  } catch (error) {
    console.log(error);
    return { status: false, filepath: null };
  }
};

module.exports = generateMp3forDescriptionText;
