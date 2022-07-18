const checkOverlaps = require('./checkOverlaps');

const checkNudgingOCR = async (
  clipStartTime,
  clipEndTime,
  videoId,
  adId,
  clipId,
  video_length,
  nudgingTime
) => {
  let incrementedStartTime = (parseFloat(clipStartTime) + nudgingTime).toFixed(
    2
  );
  let incrementedEndTime = (parseFloat(clipEndTime) + nudgingTime).toFixed(2);
  let decrementedStartTime = (parseFloat(clipStartTime) - nudgingTime).toFixed(
    2
  );
  let decrementedEndTime = (parseFloat(clipEndTime) - nudgingTime).toFixed(2);

  // initialize with null
  let checkOverlapsStatus = {
    incrementStatus: null,
    decrementStatus: null,
  };

  // Nudge Start Times and check for overlaps again
  // check if adjusted start & end times fall in the boundaries of the video
  // boundary should be 1 sec to video_length -1 second. Clip cannot start when video ends.
  if (
    incrementedStartTime <= video_length - 1 &&
    incrementedEndTime <= video_length - 1
  ) {
    const incrementStatus = await checkOverlaps(
      incrementedStartTime,
      incrementedEndTime,
      videoId,
      adId,
      clipId
    );
    if (incrementStatus.data === null) {
      return {
        message: 'Error Checking for Overlaps. Please Try again.',
        data: null,
      };
    } else {
      checkOverlapsStatus.incrementStatus = incrementStatus;
    }
  }
  // check if adjusted start & end times fall in the boundaries of the video
  //        - Not checking with 0, because, we dont want to change start time of any clip to 0
  if (decrementedStartTime >= 1 && decrementedEndTime >= 1) {
    const decrementStatus = await checkOverlaps(
      decrementedStartTime,
      decrementedEndTime,
      videoId,
      adId,
      clipId
    );
    if (decrementStatus.data === null) {
      return {
        message: 'Error Checking for Overlaps. Please Try again.',
        data: null,
      };
    } else {
      checkOverlapsStatus.decrementStatus = decrementStatus;
    }
  }

  // ANALYZE THE RETURNED OVERLAP STATUS & CHECK ALL THE POSSIBLE SCENARIOS
  let incrementStatus = checkOverlapsStatus.incrementStatus;
  let decrementStatus = checkOverlapsStatus.decrementStatus;
  // incrementStatus = null , decrementStatus = null - not possible
  // incrementStatus = null , decrementStatus = not null
  if (incrementStatus === null && decrementStatus !== null) {
    if (decrementStatus.data.overlaps) {
      return {
        message: 'Overlaps exist even if start & end times are decremented',
        data: {
          decrementStatus,
          startTime: clipStartTime,
          endTime: clipEndTime,
          playbackType: 'extended',
        },
      };
    } else {
      return {
        message: 'Overlaps do not exist if start & end times are decremented',
        data: {
          decrementStatus,
          startTime: decrementedStartTime,
          endTime: decrementedEndTime,
          playbackType: 'inline',
        },
      };
    }
  }
  // incrementStatus = not null , decrementStatus = null
  else if (incrementStatus !== null && decrementStatus === null) {
    if (incrementStatus.data.overlaps) {
      return {
        message: 'Overlaps exist even if start & end times are incremented',
        data: {
          incrementStatus,
          startTime: clipStartTime,
          endTime: clipEndTime,
          playbackType: 'extended',
        },
      };
    } else {
      return {
        message: 'Overlaps do not exist if start & end times are incremented',
        data: {
          incrementStatus,
          startTime: incrementedStartTime,
          endTime: incrementedEndTime,
          playbackType: 'inline',
        },
      };
    }
  }
  // incrementStatus = not null , decrementStatus = not null
  else if (incrementStatus !== null && decrementStatus !== null) {
    // Overlaps? true, true => extended, no change
    if (incrementStatus.data.overlaps && decrementStatus.data.overlaps) {
      return {
        message:
          'Overlaps exist even if start & end times are incremented/decremented',
        data: {
          incrementStatus,
          decrementStatus,
          startTime: clipStartTime,
          endTime: clipEndTime,
          playbackType: 'extended',
        },
      };
    }
    // Overlaps? true, false => inline, decrement
    else if (incrementStatus.data.overlaps && !decrementStatus.data.overlaps) {
      return {
        message: 'Overlaps do not exist if start & end times are decremented',
        data: {
          incrementStatus,
          decrementStatus,
          startTime: decrementedStartTime,
          endTime: decrementedEndTime,
          playbackType: 'inline',
        },
      };
    }
    // Overlaps? false, true => inline, increment
    else if (!incrementStatus.data.overlaps && decrementStatus.data.overlaps) {
      return {
        message: 'Overlaps do not exist if start & end times are incremented',
        data: {
          incrementStatus,
          decrementStatus,
          startTime: incrementedStartTime,
          endTime: incrementedEndTime,
          playbackType: 'inline',
        },
      };
    }
    // Overlaps? false, false => inline, increment (choosing to increment, can also choose decrement)
    else if (!incrementStatus.data.overlaps && !decrementStatus.data.overlaps) {
      // choose to increment when both increment & decrement work.
      return {
        message:
          'Overlaps do not exist if start & end times are incremented/decremented.',
        data: {
          incrementStatus,
          decrementStatus,
          startTime: incrementedStartTime,
          endTime: incrementedEndTime,
          playbackType: 'inline',
        },
      };
    }
  }
};

module.exports = checkNudgingOCR;
