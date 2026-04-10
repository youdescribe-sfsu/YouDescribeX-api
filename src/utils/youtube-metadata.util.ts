const ISO_8601_DURATION_REGEX = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;

export const convertYouTubeDurationToSeconds = (duration?: string): number | null => {
  if (!duration || typeof duration !== 'string') {
    return null;
  }

  const matches = ISO_8601_DURATION_REGEX.exec(duration);
  if (!matches) {
    return null;
  }

  const hours = matches[1] ? Number(matches[1]) : 0;
  const minutes = matches[2] ? Number(matches[2]) : 0;
  const seconds = matches[3] ? Number(matches[3]) : 0;
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  return totalSeconds > 0 ? totalSeconds : null;
};

export const getDurationSecondsFromYouTubeMetadata = (
  youtubeMetadata?: {
    contentDetails?: {
      duration?: string;
    };
  } | null,
): number | null => convertYouTubeDurationToSeconds(youtubeMetadata?.contentDetails?.duration);

export const getResolvedVideoDurationSeconds = (video: {
  duration?: number;
  youtube_metadata?: {
    contentDetails?: {
      duration?: string;
    };
  } | null;
}): number => {
  const metadataDuration = getDurationSecondsFromYouTubeMetadata(video.youtube_metadata);

  if (metadataDuration !== null) {
    return metadataDuration;
  }

  return typeof video.duration === 'number' ? video.duration : 0;
};
