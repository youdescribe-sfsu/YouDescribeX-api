const Audio_Clips = require('../models/Audio_Clips');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Users = require('../models/Users');
const Videos = require('../models/Videos');

// db processing is done here using sequelize models
// find all Audio_Descriptions
exports.getAllAudioDescriptions = async (req, res) => {
  Audio_Descriptions.findAll()
    .then((allAudioDescriptions) => {
      console.log(allAudioDescriptions);
      return res.send(allAudioDescriptions);
    })
    .catch((err) => console.log(err));
};

// find one Audio_Descriptions row - based on id
exports.getAudioDescription = async (req, res) => {
  ad = await Audio_Descriptions.findOne({
    where: {
      ad_id: req.params.adId,
    },
    include: [Users, Audio_Clips],
  }).catch((err) => {
    console.log(err);
  });

  console.log(ad);
  return res.send(ad);
};

// find the Audio_Descriptions - based on video_id & user_id
exports.getUserAudioDescription = async (req, res) => {
  ad = await Audio_Descriptions.findAll({
    where: {
      VideoVideoId: req.params.videoId,
      UserUserId: req.params.userId,
    },
    include: [Users, Audio_Clips],
  }).catch((err) => {
    console.log(err);
  });

  console.log(ad);
  return res.send(ad);
};

exports.newAiDescription = async (req, res) => {
  console.log(req.body);
  const audio_clips = req.body.audio_clips;

  const aiuser = await Users.create({
    user_id: 'abce2994-aa43-4abe-84ce-5f347e7dcb58',
    is_ai: true,
    name: 'YDX AI',
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
      video_name:
        'Hope For Paws: Stray dog walks into a yard and then collapses...',
      video_length: req.body,
    }).catch((e) => console.log(e));

    await ad.setVideo(vid).catch((e) => console.log(e));
  }

  await ad.setUser(aiuser);

  for (const clip of audio_clips) {
    new_clip = await Audio_Clips.create({
      clip_title: 'scene ' + clip.scene_number,
      description_text: clip.text,
      playback_type: 'extended',
      description_type: clip.type,
      clip_start_time: clip.start_time,
    });
    ad.addAudio_Clip(new_clip);
  }

  res.send(200);
};

exports.newDescription = async (req, res) => {
  // Audio_Descriptions.create({});
};
