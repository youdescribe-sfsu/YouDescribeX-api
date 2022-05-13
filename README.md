Application - YouDescribeX
This is the Backend Repository of the Express Server connecting PostgreSQL database and YouDescribeX Front End.

GET Routes for frontend - there are others but using these for now
    1) http://localhost:4000/api/audio-clips/generateMp3ForAllClipsInDB/:adId
    API to generate mp3 files for all the description texts in the Audio_Clips table - based on AudioDescriptionID
    
    2) http://localhost:4000/api/dialog-timestamps/get-video-dialog/:videoId
    API to get Dialog Timestamps for the video

    3) http://localhost:4000/api/videos/get-by-youtubeVideo/:youtubeVideoId
    API to get Video data for a youtube video

    4) http://localhost:4000/api/audio-descriptions/get-user-ad/:videoId&:userId
    API to get audio descriptions related to videoId & userId

    5) http://localhost:4000/api/audio-clips/get-user-ad/:adId
    API to get all audio clips for one audio Description

    6) http://localhost:4000/api/notes/get-note-byAdId/:adId
    API to get notes for one audiodescription

    PUT routes:
    1) axios
        .put(
            `http://localhost:4000/api/audio-clips/update-ad-description/${clip_id}`,
            {
                userId: userId,
                youtubeVideoId: youtubeVideoId,
                clipDescriptionText: clipDescriptionText,
                clipDescriptionType: clip_description_type,
            })
    2) axios
      .put(
        `http://localhost:4000/api/audio-clips/update-ad-playback-type/${clip_id}`,
        {
            clipPlaybackType: e.target.value,
        }
      )

      3) axios
      .put(`http://localhost:4000/api/audio-clips/update-ad-title/${clip_id}`, {
        adTitle: e.target.value,
      })

      4) axios
      .put(
        `http://localhost:4000/api/audio-clips/update-ad-start-time/${clip_id}`,
        {
          clipStartTime: updatedClipStartTime,
        }
      )

    POST Routes:
    1) axios
      .post('http://localhost:4000/api/notes/post-note', {
        adId: videoId,
        notes: currentNoteValue,
      })


