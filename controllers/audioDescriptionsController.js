const Audio_Clips = require("../models/Audio_Clips");
const Audio_Descriptions = require("../models/Audio_Descriptions");
const Dialog_Timestamps = require("../models/Dialog_Timestamps");
const Notes = require("../models/Notes");
const Users = require("../models/Users");
const Videos = require("../models/Videos");

// db processing is done here using sequelize models
// GET Routes
// get user Audio Description Data (including Notes, AudioClips) - based on UserId & VideoId
exports.getUserAudioDescriptionData = async (req, res) => {
  Audio_Descriptions.findOne({
    where: {
      VideoVideoId: req.params.videoId,
      UserUserId: req.params.userId,
    },
    // nesting Audio_Clips & Notes data too
    include: [
      {
        model: Audio_Clips,
        separate: true, // this is nested data, so ordering works only with separate true
        order: ["clip_start_time"],
      },
      {
        model: Notes,
      },
    ],
  })
    .then((data) => {
      // console.log(data);
      return res.send(data);
    })
    .catch((err) => {
      console.log(err);
    });
};

exports.newAiDescription = async (req, res) => {
  const dialog = req.body.dialogue_timestamps;

  const audio_clips = req.body.audio_clips;

  const aiuser = await Users.findOne({
    where: {
      user_id: "abce2994-aa43-4abe-84ce-5f347e7dcb58",
    },
  }).catch((e) => {});
  let vid = await Videos.findOne({
    where: { youtube_video_id: req.body.youtube_id },
  });
  const ad = await Audio_Descriptions.create({
    is_published: false,
  }).catch((e) => {
    console.log(e);
  });
  if (vid) {
    await ad.setVideo(vid);
  } else {
    vid = await Videos.create({
      youtube_video_id: req.body.youtube_id,
      video_name: req.body.video_name,
      video_length: req.body.video_length,
    }).catch((e) => console.log(e));
    await ad.setVideo(vid).catch((e) => console.log(e));
  }
  await ad.setUser(aiuser);
  for (const clip of audio_clips) {
    new_clip = await Audio_Clips.create({
      clip_title: "scene " + clip.scene_number,
      description_text: clip.text,
      playback_type: "extended",
      description_type: clip.type,
      clip_start_time: clip.start_time,
    });
    ad.addAudio_Clip(new_clip);
  }

  for (const timestamp of dialog) {
    new_timestamp = await Dialog_Timestamps.create({
      dialog_sequence_num: timestamp.sequence_num,
      dialog_start_time: timestamp.start_time,
      dialog_end_time: timestamp.end_time,
      dialog_duration: timestamp.duration,
    });
    new_timestamp.setVideo(vid);
  }
  res.send(200);
};
exports.newDescription = async (req, res) => {
  // Audio_Descriptions.create({});
};
