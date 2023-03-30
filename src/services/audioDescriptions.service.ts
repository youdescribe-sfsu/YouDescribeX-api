import {
  MongoAudioClipsModel,
  MongoAudio_Descriptions_Model,
  MongoDialog_Timestamps_Model,
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

const fs = require('fs');

class AudioDescriptionsService {
  public async getUserAudioDescriptionData(videoId: string, userId: string): Promise<IAudioDescription | Audio_DescriptionsAttributes> {
    if (isEmpty(videoId)) throw new HttpException(400, 'Video ID is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'User ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const audioDescription = await MongoAudio_Descriptions_Model.findOne({
        video: videoId,
        user: userId,
      })
        .populate('audio_clips')
        .populate('dialog_timestamps')
        .exec();
      return audioDescription;
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
    const { dialog_timestamps, audio_clips, aiUserId = 'db72cc2a-b054-4b00-9f85-851b45649be0', youtube_id, video_name, video_length } = newAIDescription;
    if (isEmpty(dialog_timestamps)) throw new HttpException(400, 'dialog is empty');
    if (isEmpty(audio_clips)) throw new HttpException(400, 'audio clips is empty');
    if (isEmpty(youtube_id)) throw new HttpException(400, 'youtube video id is empty');
    if (isEmpty(video_name)) throw new HttpException(400, 'video name is empty');
    if (isEmpty(video_length)) throw new HttpException(400, 'video length is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const aiUser = await MongoUsersModel.findById(aiUserId);
      if (!aiUser) throw new HttpException(404, "ai User doesn't exist");
      let vid: any = await MongoVideosModel.find({ youtube_video_id: youtube_id });
      if (!vid) throw new HttpException(404, "Video doesn't exist");
      const ad = new MongoAudio_Descriptions_Model();
      if (!ad) throw new HttpException(409, "Audio Descriptions couldn't be created");
      if (vid) {
        ad.set('video', vid._id);
      } else {
        const newVid = new MongoVideosModel();
        newVid.set('audio_descriptions', []);
        newVid.set('category', '');
        newVid.set('category_id', 0);
        newVid.set('youtube_id', youtube_id);
        newVid.set('title', video_name);
        newVid.set('duration', video_length);
        newVid.set('description', '');
        newVid.set('tags', []);
        newVid.set('custom_tags', []);
        newVid.set('views', 0);
        newVid.set('youtube_status', 'ready');
        newVid.set('updated_at', new Date());

        const newSavedVideo = await newVid.save();
        if (!newSavedVideo) throw new HttpException(409, "Video couldn't be created");
        ad.set('video', newSavedVideo._id);
        vid = newVid;
      }
      ad.set('user', aiUser);
      const new_clip = await MongoAudioClipsModel.create(
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

      const new_timestamp = await MongoDialog_Timestamps_Model.create(
        dialog_timestamps.map(timestamp => {
          return {
            video: vid,
            dialog_start_time: timestamp.start_time,
            dialog_end_time: timestamp.end_time,
            dialog_duration: timestamp.duration,
          };
        }),
      );
      if (!new_timestamp) throw new HttpException(409, "Dialog Timestamps couldn't be created");
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
      if (!vid) throw new HttpException(404, "Video doesn't exist");

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
        dialog_timestamps.map(timestamp => {
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

  public async deleteUserADAudios(youtube_video_id: string, userId: string) {
    if (isEmpty(youtube_video_id)) throw new HttpException(400, 'Youtube Video ID is empty');
    if (isEmpty(userId)) throw new HttpException(400, 'User ID is empty');

    // if (CURRENT_DATABASE == 'mongodb') {
    // } else {
    const pathToFolder = `${AUDIO_DIRECTORY}/audio/${youtube_video_id}/${userId}`;
    logger.info(`pathToFolder: ${pathToFolder}`);
    // const pathToFolder = path.join(__dirname, '../../', `.${AUDIO_DIRECTORY}/${youtube_video_id}/${userId}`);
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
}

export default AudioDescriptionsService;
