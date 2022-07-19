const checkForGaps = async (
  clipStartTime,
  clipEndTime,
  videoId,
  adId,
  clipId,
  video_length
) => {
  return {
    message: 'Overlaps Exist - NonOCR',
    data: {
      playbackType: 'inline',
      clipStartTime: clipStartTime,
      clipEndTime: clipEndTime,
    },
  };
};

module.exports = checkForGaps;
