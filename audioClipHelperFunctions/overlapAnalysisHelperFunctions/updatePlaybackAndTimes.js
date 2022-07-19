const Audio_Clips = require('../../models/Audio_Clips');

const updatePlaybackAndTimes = async (
  clipId,
  playbackType,
  clipStartTime,
  clipEndTime
) => {
  console.log('*********************************************************');
  console.log(clipId, playbackType, clipStartTime, clipEndTime);
  return Audio_Clips.update(
    {
      clip_start_time: parseFloat(clipStartTime).toFixed(2),
      clip_end_time: parseFloat(clipEndTime).toFixed(2),
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
        message: 'Updated Playback Type, Start Time & End Time',
        data: clip,
      };
    })
    .catch((err) => {
      return {
        message: 'Erorr in Updating Playback Type, Start Time & End Time' + err,
        data: null,
      };
    });
};

module.exports = updatePlaybackAndTimes;
