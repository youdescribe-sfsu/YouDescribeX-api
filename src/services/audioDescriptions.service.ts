import {
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoDialog_Timestamps_Model,
  MongoNotesModel,
  MongoUsersModel,
  MongoVideosModel,
} from '../models/mongodb/init-models.mongo';
import { AUDIO_DIRECTORY, CURRENT_DATABASE } from '../config';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { HttpException } from '../exceptions/HttpException';
import {
  Audio_DescriptionsAttributes,
  PostGres_Audio_Clips,
  PostGres_Audio_Descriptions,
  PostGres_Dialog_Timestamps,
  PostGres_Notes,
  PostGres_Users,
  PostGres_Videos,
} from '../models/postgres/init-models';
import { logger } from '../utils/logger';
import { isEmpty } from '../utils/util';
import { IAudioDescription } from '../models/mongodb/AudioDescriptions.mongo';
import { ObjectId } from 'mongodb';
import { getVideoDataByYoutubeId, isVideoAvailable } from './videos.util';

const fs = require('fs');

class AudioDescriptionsService {
  public async getUserAudioDescriptionData(
    videoId: string,
    userId: string,
    audio_description_id: string,
  ): Promise<IAudioDescription | Audio_DescriptionsAttributes> {
    if (isEmpty(videoId)) throw new HttpException(400, 'Video ID is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'Audio Description ID is empty');
    console.log('audio_description_id', audio_description_id);
    if (isEmpty(audio_description_id)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
        _id: audio_description_id,
        user: userId,
      });

      if (!audioDescriptions) throw new HttpException(409, "Audio Description for this YouTube Video doesn't exist");
      const audio_clips = audioDescriptions.audio_clips;
      const audioClipArr = await MongoAudioClipsModel.find({
        audio_description: audioDescriptions._id,
      })
        .sort({
          start_time: 'asc',
          end_time: 'asc',
        })
        .exec();

      if (audio_clips.length !== audioClipArr.length) {
        logger.error(
          `Number of Audio Clips in Audio Description Collection (${audio_clips.length})does not match actual number of AUdio Clips (${audioClipArr.length}).`,
        );
        throw new HttpException(409, 'Something went wrong getting Audio Clips for Audio Description');
      }
      const transformedAudioClipArr = [];
      for (let i = 0; i < audioClipArr.length; i++) {
        const audioClip = audioClipArr[i];
        const transformedAudioClip = {
          clip_id: audioClip._id,
          clip_title: audioClip.label,
          description_type: audioClip.description_type,
          description_text: audioClip.description_text || audioClip.transcript.map(obj => obj.sentence).join(' '),
          playback_type: audioClip.playback_type,
          clip_start_time: audioClip.start_time,
          clip_end_time: audioClip.end_time,
          clip_duration: audioClip.duration,
          clip_audio_path: audioClip.file_name ? audioClip.file_path + '/' + audioClip.file_name : audioClip.file_path,
          is_recorded: false,
          createdAt: audioClip.created_at,
          updatedAt: audioClip.updated_at,
          AudioDescriptionAdId: audioClip,
        };
        transformedAudioClipArr.push(transformedAudioClip);
      }

      const notes = await MongoNotesModel.find({ audio_description: audioDescriptions._id });

      const transformedNotes = notes.map(note => {
        return {
          notes_id: note._id,
          notes_text: note.notes_text,
          AudioDescriptionAdId: note.audio_description,
        };
      });

      const newObj = {
        Audio_Clips: transformedAudioClipArr,
        Notes: transformedNotes,
        UserUserId: audioDescriptions.user,
        VideoVideoId: videoId,
        ad_id: audioDescriptions._id,
        createdAt: audioDescriptions.created_at,
        updatedAt: audioDescriptions.updated_at,
        is_published: audioDescriptions.status === 'published',
      };

      return newObj;
    } else {
      const audioDescriptions: Audio_DescriptionsAttributes = await PostGres_Audio_Descriptions.findOne({
        where: {
          VideoVideoId: videoId,
          UserUserId: userId,
        },
        // nesting Audio_Clips & Notes data too
        include: [
          {
            model: PostGres_Audio_Clips,
            separate: true, // this is nested data, so ordering works only with separate true
            order: ['clip_start_time'],
            as: 'Audio_Clips',
          },
          {
            model: PostGres_Notes,
            as: 'Notes',
          },
        ],
      });
      return audioDescriptions;
    }
  }

  public async newAiDescription(newAIDescription: NewAiDescriptionDto): Promise<IAudioDescription | Audio_DescriptionsAttributes> {
    const { dialogue_timestamps, audio_clips, aiUserId = 'db72cc2a-b054-4b00-9f85-851b45649be0', youtube_id, video_name, video_length } = newAIDescription;
    // if (isEmpty(dialogue_timestamps)) throw new HttpException(400, 'dialog is empty');
    if (isEmpty(audio_clips)) throw new HttpException(400, 'audio clips is empty');
    if (isEmpty(youtube_id)) throw new HttpException(400, 'youtube video id is empty');
    if (isEmpty(video_name)) throw new HttpException(400, 'video name is empty');
    if (isEmpty(video_length)) throw new HttpException(400, 'video length is empty');

    const youtubeVideoData = await isVideoAvailable(youtube_id);

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData provided');
    }

    if (CURRENT_DATABASE == 'mongodb') {
      console.log('aiUserId', aiUserId);
      const aiUserObjectId = new ObjectId(aiUserId);
      const aiUser = await MongoUsersModel.findById(aiUserObjectId);
      if (!aiUser) throw new HttpException(404, "ai User doesn't exist");
      let vid: any = await MongoVideosModel.findOne({ youtube_id: youtube_id });
      const ad = new MongoAudio_Descriptions_Model();
      if (!ad) throw new HttpException(409, "Audio Descriptions couldn't be created");
      if (vid) {
        ad.set('video', vid._id);
        // Add Audio Description to Video Audio Description Array for consistency with old MongodB and YD Classic logic
        await MongoVideosModel.findByIdAndUpdate(vid._id, {
          $push: {
            audio_descriptions: {
              $each: [{ _id: ad._id }],
            },
          },
        }).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Video couldn't be updated.");
        });
      } else {
        const newVid = new MongoVideosModel({
          audio_descriptions: [],
          category: '',
          category_id: 0,
          youtube_id: youtube_id,
          title: video_name,
          duration: video_length,
          description: '',
          tags: [],
          custom_tags: [],
          views: 0,
          youtube_status: 'ready',
          updated_at: new Date(),
        });
        const newSavedVideo = await newVid.save();
        if (!newSavedVideo) throw new HttpException(409, "Video couldn't be created");
        await MongoVideosModel.findByIdAndUpdate(newVid._id, {
          $push: {
            audio_descriptions: {
              $each: [{ _id: ad._id }],
            },
          },
        }).catch(err => {
          logger.error(err);
          throw new HttpException(409, "Video couldn't be updated.");
        });
        ad.set('video', newSavedVideo._id);
        vid = newSavedVideo;
      }
      ad.set('user', aiUser);
      const new_clip = await MongoAudioClipsModel.insertMany(
        audio_clips.map(clip => {
          return {
            audio_description: ad._id,
            user: aiUser._id,
            video: vid._id,
            description_text: clip.text,
            description_type: clip.type,
            label: `scene ${clip.scene_number}`,
            playback_type: 'extended',
            start_time: clip.start_time,
          };
        }),
      );
      if (!new_clip) throw new HttpException(409, "Audio Clips couldn't be created");
      ad.set(
        'audio_clips',
        new_clip.map(clip => clip._id),
      );

      const new_timestamp = await MongoDialog_Timestamps_Model.create(
        dialogue_timestamps.map(timestamp => {
          return {
            video: vid,
            dialog_sequence_num: timestamp.sequence_num,
            dialog_start_time: timestamp.start_time,
            dialog_end_time: timestamp.end_time,
            dialog_duration: timestamp.duration,
          };
        }),
      );
      if (!new_timestamp) throw new HttpException(409, "Dialog Timestamps couldn't be created");
      console.log('new_timestamp', ad);
      ad.save();
      return ad;
    } else {
      const aiUser = await PostGres_Users.findOne({
        where: {
          user_id: aiUserId, // AI User ID
        },
      });
      if (!aiUser) throw new HttpException(404, "ai User doesn't exist");

      let vid = await PostGres_Videos.findOne({
        where: { youtube_video_id: youtube_id },
      });

      const ad = await PostGres_Audio_Descriptions.create({
        is_published: false,
      });
      if (!ad) throw new HttpException(409, "Audio Descriptions couldn't be created");

      if (vid) {
        await ad.setVideoVideo(vid);
      } else {
        vid = await PostGres_Videos.create({
          youtube_video_id: youtube_id,
          video_name: video_name,
          video_length: video_length,
        });
        if (!vid) throw new HttpException(409, "Videos couldn't be created");

        await ad.setVideoVideo(vid);
      }

      await ad.setUserUser(aiUser);

      const new_clip = await PostGres_Audio_Clips.bulkCreate(
        audio_clips.map(clip => {
          return {
            clip_title: 'scene ' + clip.scene_number,
            description_text: clip.text,
            playback_type: 'extended',
            description_type: clip.type,
            clip_start_time: clip.start_time,
          };
        }),
      );
      if (!new_clip) throw new HttpException(409, "Audio Clips couldn't be created");

      const new_timestamp = await PostGres_Dialog_Timestamps.bulkCreate(
        dialogue_timestamps.map(timestamp => {
          return {
            dialog_sequence_num: timestamp.sequence_num,
            dialog_start_time: timestamp.start_time,
            dialog_end_time: timestamp.end_time,
            dialog_duration: timestamp.duration,
          };
        }),
      );
      if (!new_timestamp) throw new HttpException(409, "Dialog Timestamps couldn't be created");

      return ad;
    }
  }

  public async deleteUserADAudios(youtube_video_id: string, adId: string) {
    if (isEmpty(youtube_video_id)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(adId)) throw new HttpException(400, 'Audio Description ID is empty');
    // TODO: Change this so that it grabs from the DB and gets the individual paths for each audio clip since the path to folder may change
    // if (CURRENT_DATABASE == 'mongodb') {
    // } else {
    const pathToFolder = `${AUDIO_DIRECTORY}/audio/${youtube_video_id}/${adId}`;
    logger.info(`pathToFolder: ${pathToFolder}`);
    // const pathToFolder = path.join(__dirname, '../../', `.${AUDIO_DIRECTORY}/${youtube_video_id}/${adId}`);
    const files = fs.readdir(pathToFolder);
    if (!files) throw new HttpException(409, 'Error Reading Folder. Please check later!');

    let dataToSend = [];
    files.forEach((file, i) => {
      fs.unlinkSync(pathToFolder + '/' + file);
      dataToSend.push({
        SerialNumber: i + 1,
        file: file,
        status: 'File Deleted Successfully.',
      });
    });
    if ((dataToSend = [])) {
      throw new HttpException(409, 'Error Deleting Files. Please check later!');
    }
    logger.info('User AD deleted successfully');
    return dataToSend;
    // }
  }

  public publishAudioDescription = async (
    audioDescriptionId: string,
    video_id: string,
    user_id: string,
    enrolled_in_collaborative_editing: boolean,
  ): Promise<string> => {
    try {
      const videoIdStatus = await MongoVideosModel.findOne({ youtube_id: video_id });

      if (!videoIdStatus) {
        throw new HttpException(400, 'No videoIdStatus provided');
      }
      const checkIfAudioDescriptionExists = await MongoAudio_Descriptions_Model.findOne({
        video: videoIdStatus._id,
        user: user_id,
      });

      if (!checkIfAudioDescriptionExists) {
        throw new HttpException(404, 'No audioDescriptionId Found');
      }

      const audioDescription = await MongoAudio_Descriptions_Model.findByIdAndUpdate(audioDescriptionId, {
        status: 'published',
        collaborative_editing: enrolled_in_collaborative_editing,
      });
      audioDescription.save();
      return audioDescription._id.toString();
    } catch (error) {
      logger.error(error);
      throw error;
    }
  };

  public getAudioDescription = async (audioDescriptionId: string): Promise<IAudioDescription | Audio_DescriptionsAttributes> => {
    const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
      _id: audioDescriptionId,
    });

    if (!audioDescriptions) throw new HttpException(409, "Audio Description for this YouTube Video doesn't exist");

    if (audioDescriptions.status !== 'published') throw new HttpException(409, 'Audio Description for this YouTube Video is not published');

    const videoId = audioDescriptions.video;
    const youtubeVideoData = await MongoVideosModel.findById({
      _id: videoId,
    });

    if (!youtubeVideoData) {
      throw new HttpException(400, 'No youtubeVideoData Found');
    }

    const audio_clips = audioDescriptions.audio_clips;
    const audioClipArr = await MongoAudioClipsModel.find({
      audio_description: audioDescriptions._id,
    })
      .sort({
        start_time: 'asc',
        end_time: 'asc',
      })
      .exec();

    if (audio_clips.length !== audioClipArr.length) {
      logger.error(
        `Number of Audio Clips in Audio Description Collection (${audio_clips.length})does not match actual number of AUdio Clips (${audioClipArr.length}).`,
      );
      throw new HttpException(409, 'Something went wrong getting Audio Clips for Audio Description');
    }
    const transformedAudioClipArr = [];
    for (let i = 0; i < audioClipArr.length; i++) {
      const audioClip = audioClipArr[i];
      const transformedAudioClip = {
        clip_id: audioClip._id,
        clip_title: audioClip.label,
        description_type: audioClip.description_type,
        description_text: audioClip.description_text || audioClip.transcript.map(obj => obj.sentence).join(' '),
        playback_type: audioClip.playback_type,
        clip_start_time: audioClip.start_time,
        clip_end_time: audioClip.end_time,
        clip_duration: audioClip.duration,
        clip_audio_path: audioClip.file_name ? audioClip.file_path + '/' + audioClip.file_name : audioClip.file_path,
        is_recorded: false,
        createdAt: audioClip.created_at,
        updatedAt: audioClip.updated_at,
        AudioDescriptionAdId: audioClip,
      };
      transformedAudioClipArr.push(transformedAudioClip);
    }

    const notes = await MongoNotesModel.find({ audio_description: audioDescriptions._id });

    const transformedNotes = notes.map(note => {
      return {
        notes_id: note._id,
        notes_text: note.notes_text,
        AudioDescriptionAdId: note.audio_description,
      };
    });

    const newObj = {
      Audio_Clips: transformedAudioClipArr,
      Notes: transformedNotes,
      UserUserId: audioDescriptions.user,
      VideoVideoId: videoId,
      ad_id: audioDescriptions._id,
      createdAt: audioDescriptions.created_at,
      updatedAt: audioDescriptions.updated_at,
      is_published: audioDescriptions.status === 'published',
      youtube_id: youtubeVideoData.youtube_id,
      editing_allowed: audioDescriptions.collaborative_editing,
    };

    return newObj;
  };

  public async getRecentDescriptions(pageNumber: string) {
    const page = parseInt(pageNumber, 10);
    const perPage = 4;
    const skipCount = Math.max((page - 1) * perPage, 0);
    const recentAudioDescriptions = await MongoAudio_Descriptions_Model.find().sort({ created_at: -1 }).skip(skipCount).limit(perPage);
    const videoIds = recentAudioDescriptions.map(description => description.video);
    const videos = await MongoVideosModel.find({ _id: { $in: videoIds } });

    const totalVideos = await MongoAudio_Descriptions_Model.countDocuments();

    const result = videos.map(video => {
      const audioDescription = recentAudioDescriptions.find(ad => ad.video == `${video._id}`);

      return {
        video_id: video._id,
        youtube_video_id: video.youtube_id,
        video_name: video.title,
        video_length: video.duration,
        createdAt: video.created_at,
        updatedAt: video.updated_at,
        audio_description_id: audioDescription._id,
        status: audioDescription.status,
        overall_rating_votes_average: audioDescription.overall_rating_votes_average,
        overall_rating_votes_counter: audioDescription.overall_rating_votes_counter,
        overall_rating_votes_sum: audioDescription.overall_rating_votes_sum,
      };
    });
    return { totalVideos, result };
  }
}

export default AudioDescriptionsService;
