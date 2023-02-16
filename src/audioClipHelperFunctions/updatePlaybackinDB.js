const Audio_Clips = require('../models/Audio_Clips');

const updatePlaybackinDB = async (clipId, playbackType) => {
  return Audio_Clips.update(
    {
      playback_type: playbackType,
    },
    {
      where: {
        clip_id: clipId,
      },
    }
  )
    .then(async (clip) => {
      return {
        message: 'Updated Playback Type',
        data: clip,
      };
    })
    .catch((err) => {
      return {
        message: 'Error in Updating Playback Type' + err,
        data: null,
      };
    });
};

module.exports = updatePlaybackinDB;
