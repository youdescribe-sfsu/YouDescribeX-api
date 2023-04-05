import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { Dialog_TimestampsAttributes, PostGres_Dialog_Timestamps } from '../models/postgres/init-models';
import { MongoDialog_Timestamps_Model } from '../models/mongodb/init-models.mongo';
import { DialogTimestamps } from '../models/mongodb/DialogTimeStamps.mongo';

class DialogTimestampsService {
  public async getVideoDialogTimestamps(videoId: string): Promise<DialogTimestamps[] | Dialog_TimestampsAttributes[]> {
    if (isEmpty(videoId)) throw new HttpException(400, 'videoId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findDialogTimestampsById = await MongoDialog_Timestamps_Model.find({ video: videoId });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
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
      const findDialogTimestampsById: Dialog_TimestampsAttributes[] = await PostGres_Dialog_Timestamps.findAll({
        where: { VideoVideoId: videoId },
      });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
      return findDialogTimestampsById;
    }
  }
}

export default DialogTimestampsService;
