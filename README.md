**Application - YouDescribeX**
> This is the Backend Repository of the Express Server connecting PostgreSQL database and YouDescribeX Front End.

**GET Routes**
* <http://localhost:4000/api/audio-clips/generateMp3ForAllClipsInDB/:adId>
    <br />
    *API to generate mp3 files for all the description texts in the Audio_Clips table - based on AudioDescriptionID*
* <http://localhost:4000/api/dialog-timestamps/get-video-dialog/:videoId>
    <br />
    *API to get Dialog Timestamps for the video*
* <http://localhost:4000/api/videos/get-by-youtubeVideo/:youtubeVideoId>
     <br />
     *API to get Video data for a youtube video*
* http://localhost:4000/api/audio-descriptions/get-user-ad/:videoId&:userId
    <br />
    *API to get audio descriptions & Audio Clips related to videoId & userId*
* http://localhost:4000/api/notes/get-note-byAdId/:adId
    <br />
    *API to get notes for one audiodescription*

**PUT Routes**
```
axios
  .put(
      `http://localhost:4000/api/audio-clips/update-ad-description/${clip_id}`,
      {
          userId: userId,
          youtubeVideoId: youtubeVideoId,
          clipDescriptionText: clipDescriptionText,
          clipDescriptionType: clip_description_type,
      })
```    
```
axios
  .put(
    `http://localhost:4000/api/audio-clips/update-ad-playback-type/${clip_id}`,
      {
          clipPlaybackType: e.target.value,
      }
    )
```    
```
axios
  .put(`http://localhost:4000/api/audio-clips/update-ad-title/${clip_id}`, {
    adTitle: e.target.value,
  })
```

```
axios
  .put(
    `http://localhost:4000/api/audio-clips/update-ad-start-time/${clip_id}`,
    {
        clipStartTime: updatedClipStartTime,
     }
  )
```

**POST Routes:**
```
axios
  .post('http://localhost:4000/api/notes/post-note', {
    noteId: noteId,
    notes: currentNoteValue,
    adId: audioDescriptionId,
  })
```
**Notes:**
1) Sequelize Lazy Loading Example:
```
const audioClips = await UserAudioDescription.getAudio_Clips();
```
2) Sequelize Eager Loading Example:
```
Audio_Clips.findAll({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
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
```