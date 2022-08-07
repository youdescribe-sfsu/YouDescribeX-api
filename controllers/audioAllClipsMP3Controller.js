const Audio_Clips = require('../models/Audio_Clips');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Videos = require('../models/Videos');

// import processor files
const generateMp3forDescriptionText = require('../processors/textToSpeech');
// import Audio Clip helper files
const processCurrentClip = require('../audioClipHelperFunctions/processCurrentClip'); // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
const nudgeStartTimeIfZero = require('../audioClipHelperFunctions/nudgeStartTimeIfZero');

// process all audio clips, generate Text to Speech, analyze start times & playback types
exports.processAllClipsInDB = async (req, res) => {
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
            attributes: ['youtube_video_id', 'video_length'],
          },
        ],
      },
    ],
    logging: false,
  })
    // get all the AudioClips Data along with userID, videoID, YoutubeVideoID
    .then(async (ADAudioClips) => {
      // if there are no matching audioclips
      if (ADAudioClips.length === 0) {
        return res.status(404).send({
          message: 'No Audio Clips found!! Please try again',
        });
      }
      // proceed only if audioclips exist
      else {
        // add 1 second to the start time of the audio clips which start at 0sec (rounded - floor)
        let nudgeStatus = await nudgeStartTimeIfZero(ADAudioClips);
        // error while nudging start time
        if (nudgeStatus.data === null) {
          return res.status(500).send({
            message: nudgeStatus.message,
          }); // send error message
        }
        // nudging successful (added 1 sec to start time if zero)
        else {
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
              video_length: clip.Audio_Description.Video.video_length,
            };
            // push each clip data to the array
            descriptionTexts.push(obj);
          });
          return descriptionTexts;
        }
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
            ad_id: req.params.adId,
            description_type: desc.clip_description_type,
            video_length: desc.video_length,
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
            let updateStatus = await processCurrentClip(data);
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
