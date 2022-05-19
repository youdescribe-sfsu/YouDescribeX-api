const Audio_Clips = require('../models/Audio_Clips');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Videos = require('../models/Videos');

// import processor files
const generateMp3forDescriptionText = require('../processors/textToSpeech');
// import Audio Clip helper files
const updateClipDataInDB = require('../audioClipHelperFunctions/updateClipDataInDB'); // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table

// db processing to generate mp3 for all audio clip texts
exports.generateMP3ForAllClipsInDB = async (req, res) => {
  // generate mp3 for all audio clips - given audio description ID as a parameter
  console.log(
    'Fetching Audio Video Data from Audio_Clips, Audio_Descriptions, Videos'
  );
  Audio_Clips.findAll({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
    // nesting the associations to fetch userID, videoID, YoutubeVideoID - eager loading example
    include: [
      {
        model: Audio_Descriptions,
        attributes: ['UserUserId', 'VideoVideoId'],
        include: [
          {
            model: Videos,
            attributes: ['youtube_video_id'],
          },
        ],
      },
    ],
  })
    // get all the AudioClips Data along with userID, videoID, YoutubeVideoID
    .then((ADAudioClips) => {
      // proceed only if audioclips exist
      if (ADAudioClips.length > 0) {
        // initialize an array to store the description texts
        let descriptionTexts = [];
        ADAudioClips.forEach((clip) => {
          // create an obj to store the related stuff
          let obj = {
            clip_id: clip.clip_id,
            clip_description_type: clip.description_type,
            clip_description_text: clip.description_text,
            video_id: clip.Audio_Description.VideoVideoId,
            user_id: clip.Audio_Description.UserUserId,
            youtube_id: clip.Audio_Description.Video.youtube_video_id,
          };
          // push each clip data to the array
          descriptionTexts.push(obj);
        });
        return descriptionTexts;
      }
      // if there are no matching audioclips
      else {
        return res.status(404).send({
          message: 'No Audio Clips found!! Please try again',
        });
      }
    })
    .then(async (descriptionTexts) => {
      // initialize an empty array for storing statusData
      let statusData = [];
      // wait for text to speech generation of all description texts
      await Promise.all(
        descriptionTexts.map(async (desc) => {
          console.log('Generating Text to Speech');
          // add the text to speech output and the clip_id to an object and push to statusData
          let data = {
            textToSpeechOutput: await generateMp3forDescriptionText(
              desc.user_id,
              desc.youtube_id,
              desc.clip_description_text,
              desc.clip_description_type
            ),
            clip_id: desc.clip_id,
            video_id: desc.video_id,
          };
          statusData.push(data);
        })
        // status Data now has text to speech generation status of each clip_id
      ).then(async () => {
        let updateStatusOfAllClips = [];
        // wait until all promises are done
        await Promise.all(
          statusData.map(async (data) => {
            console.log('Yet to update data in DB');
            // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
            let updateStatus = await updateClipDataInDB(data);
            // get the status message and push it to an array
            updateStatusOfAllClips.push(updateStatus);
          })
        ).then(() => {
          // send the status messages along with the clip_id's as a response
          res.send(updateStatusOfAllClips);
        });
      });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send({
        message: 'Unable to connect to DB!! Please try again',
      }); // send error message
    });
};
