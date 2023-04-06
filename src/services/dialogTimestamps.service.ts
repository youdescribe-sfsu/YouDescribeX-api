import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE, CURRENT_MONGO_DB } from '../config';
import { Dialog_TimestampsAttributes, PostGres_Dialog_Timestamps } from '../models/postgres/init-models';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoDialog_Timestamps_Model } from '../models/mongodb/init-models.mongo';
import { DialogTimestamps } from '../models/mongodb/DialogTimeStamps.mongo';

class DialogTimestampsService {
  public async getVideoDialogTimestamps(videoId: string): Promise<DialogTimestamps[] | Dialog_TimestampsAttributes[]> {
    if (isEmpty(videoId)) throw new HttpException(400, 'videoId is empty');
    if (CURRENT_DATABASE == 'mongodb') {
      const findDialogTimestampsById = await MongoDialog_Timestamps_Model.find({ video: videoId });
      if (findDialogTimestampsById) {
        const return_arr = findDialogTimestampsById.map(dialogTimestamp => {
          const return_val = {
            dialog_id: dialogTimestamp._id,
            dialog_sequence_num: dialogTimestamp.dialog_sequence_num,
            dialog_start_time: dialogTimestamp.dialog_start_time,
            dialog_end_time: dialogTimestamp.dialog_end_time,
            dialog_duration: dialogTimestamp.dialog_duration,
            VideoVideoId: dialogTimestamp.video,
          };
          return return_val as unknown as DialogTimestamps;
        });
        return return_arr;
      } else {
        const audioDescriptions = await MongoAudio_Descriptions_Model.findOne({
          video: videoId,
        });
        if (!audioDescriptions) throw new HttpException(409, "Audio Description for this YouTube Video doesn't exist");
        const audio_clips = audioDescriptions.audio_clips.sort((a, b) => Number(a.clip_start_time) - Number(b.clip_start_time));
        const newAudioClipArr = [];
        for (let i = 0; i < audio_clips.length; i++) {
          const audioClip = audio_clips[i];
          const findAudioClip = await MongoAudioClipsModel.findById(audioClip);
          const transformedAudioClip = {
            dialog_id: findAudioClip._id,
            dialog_sequence_num: i,
            clip_title: findAudioClip.label,
            dialog_start_time: findAudioClip.start_time,
            dialog_end_time: Number(Number(findAudioClip.start_time + findAudioClip.duration).toFixed(2)),
            dialog_duration: findAudioClip.duration,
            VideoVideoId: findAudioClip.video,
            createdAt: findAudioClip.created_at,
            updatedAt: findAudioClip.updated_at,
          };
          newAudioClipArr.push(transformedAudioClip);
        }
        return newAudioClipArr as unknown as DialogTimestamps[];
      }
    } else {
      const findDialogTimestampsById: Dialog_TimestampsAttributes[] = await PostGres_Dialog_Timestamps.findAll({
        where: { VideoVideoId: videoId },
      });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
      return findDialogTimestampsById;
    }
  }
}

export default DialogTimestampsService;
