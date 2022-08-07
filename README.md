<font color='Magenta'>**Application - YouDescribeX**</font>
> This is the Backend Repository of the Express Server connecting PostgreSQL database and YouDescribeX Front End.

<font color='cyan'>**GET Routes:**</font>

*API to get Dialog Timestamps for the video*
* <http://localhost:4000/api/dialog-timestamps/get-video-dialog/:videoId>

*API to get Video data for a youtube video*
* <http://localhost:4000/api/videos/get-by-youtubeVideo/:youtubeVideoId>

*API to get audio descriptions & Audio Clips related to videoId & userId*
* http://localhost:4000/api/audio-descriptions/get-user-ad/:videoId&:userId

> Not used in FrontEnd Repo

*API to process all audio clips, generate Text to Speech, analyze start times & playback types in the Audio_Clips table - based on AudioDescriptionID*
* <http://localhost:4000/api/audio-clips/preProcessAllClipsInDB/:adId>

<font color='cyan'>**PUT Routes:**</font>

* *Handle update of Audio Clip Description Text*
```
axios
  .put(`/api/audio-clips/update-clip-description/${clip_id}`, {
    userId: userId,
    youtubeVideoId: youtubeVideoId,
    clipDescriptionText: clipDescriptionText,
    clipDescriptionType: clip_description_type,
    audioDescriptionId: props.audioDescriptionId,
  })
```
* *Handle update of Audio Clip Playback Type (Inline/Extended)*
```
axios
  .put(`/api/audio-clips/update-clip-playback-type/${clip_id}`, {
    clipPlaybackType: e.target.value,
  })
```    
* *Handle update of Audio Clip Title*
```
axios
  .put(`/api/audio-clips/update-clip-title/${clip_id}`, {
    adTitle: e.target.value,
  })
```
* *Handle update of start time from handleLeftNudgeClick,handleRightNudgeClick, stopADBar*
```
axios
  .put(`/api/audio-clips/update-clip-start-time/${clip_id}`, {
    clipStartTime: updatedClipStartTime,
  })
```
* *Handle Record & Replace Clip Audio*
```
let formData = new FormData();
formData.append('clipDescriptionText', clipDescriptionText);
formData.append('clipStartTime', props_clip_start_time);
formData.append('newACType', clip_description_type);
formData.append('youtubeVideoId', youtubeVideoId);
formData.append('recordedClipDuration', recordedClipDuration);
formData.append('audioDescriptionId', props.audioDescriptionId);
formData.append('userId', userId);
formData.append('file', audioFile);

axios
  .put(`/api/audio-clips/record-replace-clip-audio/${clip_id}`,
    formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      reportProgress: true,
      observe: 'events',
    })
```

<font color='cyan'>**POST Routes:**</font>

* *Handle Save New Audio Clip*
```
let formData = new FormData();
formData.append('newACTitle', newACTitle);
formData.append('newACType', newACType);
formData.append('newACPlaybackType', newACPlaybackType);
formData.append('newACStartTime', newACStartTime);
formData.append('isRecorded', isRecorded);
formData.append('youtubeVideoId', youtubeVideoId);
formData.append('userId', userId);
formData.append('newACDescriptionText', newACDescriptionText);
formData.append('newACDuration', newACDuration);
formData.append('file', audioFile);

axios
  .post(`/api/audio-clips/add-new-clip/${audioDescriptionId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    reportProgress: true,
    observe: 'events',
  })
```

* *API to post a new Note*
```
axios
  .post('http://localhost:4000/api/notes/post-note', {
    noteId: noteId,
    notes: currentNoteValue,
    adId: audioDescriptionId,
  })
```
> Not used in FrontEnd Repo
* *API to create a new user - give isAI, name, email in req.body*
  * ```http://localhost:4000/api/create-user-links/add-new-user```

<br />

> Not used in FrontEnd Repo
* *API to create new user Audio Description & Add Audio Clips - checks if there is AD with AI user ID*
  * ```http://localhost:4000/api/create-user-links/create-new-user-ad```
  ```
  Example req.body: 
  {
      "userId" : "0571fa0e-32df-4aa7-bdeb-a97706f8135a",
      "youtubeVideoId" : "usTc08X1b4I"
  }
  ```

<font color='cyan'>**DELETE Routes:**</font>
* *API to delete a Note*
```
axios
  .delete(`/api/audio-clips/delete-clip/${clip_id}`)
```
* *API to delete User Audio Files - based on YoutubeVideoID & User ID*
```
http://ydx-youdescribe.org/api/audio-descriptions/delete-user-ad-audios/${youtubeVideoId}&${user_id}
```

<font color='cyan'>**Developer Notes:**</font>
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
