const checkForGaps = require('./checkForGaps');
const checkNudgingOCR = require('./checkNudgingOCR');
const checkOverlaps = require('./checkOverlaps');

// analyze clip playback type & Start Time from dialog timestamps & Audio Clips data
const analyzeOverlapsAndAdjust = async (
  clipStartTime,
  clipEndTime,
  videoId,
  adId,
  clipId,
  descriptionType,
  video_length
) => {
  const checkOverlapsStatus = await checkOverlaps(
    clipStartTime,
    clipEndTime,
    videoId,
    adId,
    clipId
  );
  if (checkOverlapsStatus.data === null) {
    return {
      message: 'Error Checking for Overlaps. Please Try again.',
      data: null,
    };
  } else {
    if (!checkOverlapsStatus.data.overlaps) {
      // No Overlaps - No further changes
      return {
        message: 'Success - No Overlaps - No further changes',
        data: {
          playbackType: 'inline',
          clipStartTime: clipStartTime,
          clipEndTime: clipEndTime,
        },
      };
    } else {
      // Overlaps exist
      if (descriptionType === 'Text on Screen') {
        // check possibilities of incrementing / decrementing the start & end times
        const nudgingTime = 2;
        return await checkNudgingOCR(
          clipStartTime,
          clipEndTime,
          videoId,
          adId,
          clipId,
          video_length,
          nudgingTime
        );
      }
      // descriptionType is 'Visual'
      else {
        return await checkForGaps(
          clipStartTime,
          clipEndTime,
          videoId,
          adId,
          clipId,
          video_length
        );
      }
    }
  }
};

module.exports = analyzeOverlapsAndAdjust;
