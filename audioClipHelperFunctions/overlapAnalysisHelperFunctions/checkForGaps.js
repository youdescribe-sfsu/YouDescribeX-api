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
      descriptionType: 'inline',
    },
  };
};

module.exports = checkForGaps;
