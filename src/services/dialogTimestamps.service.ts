import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { Dialog_TimestampsAttributes, PostGres_Dialog_Timestamps } from '../models/postgres/init-models';
import { IDialogTimeStamps } from '../interfaces/dialogTimestamps.interface';
import { MongoDialog_Timestamps_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { DialogTimestamps } from '../models/mongodb/DialogTimeStamps.mongo';
// Dialog Timestamps Imports
// import { MongoDialog_Timestamps_Model } from '../models/mongodb/init-models.mongo';
class DialogTimestampsService {
  public async getVideoDialogTimestamps(videoId: string): Promise<DialogTimestamps[] | Dialog_TimestampsAttributes[]> {
    if (isEmpty(videoId)) throw new HttpException(400, 'videoId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findYTVideoId = await MongoVideosModel.findById(videoId);
      if (!findYTVideoId) throw new HttpException(409, "YouTube Video doesn't exist");
      const findDialogTimestampsById = await MongoDialog_Timestamps_Model.find({ youtube_video_id: findYTVideoId.youtube_id });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
      return findDialogTimestampsById;
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
