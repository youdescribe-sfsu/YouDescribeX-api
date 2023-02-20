import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { Dialog_TimestampsAttributes, PostGres_Dialog_Timestamps } from '../models/postgres/init-models';
import { IDialogTimeStamps } from '../interfaces/dialogTimestamps.interface';
// Dialog Timestamps Imports
import { DialogTimeStamps as mongodbDialogTimestamps } from '../models/mongodb/DialogTimeStamps.mongo.model';
class DialogTimestampsService {
  public async getVideoDialogTimestamps(videoId: string): Promise<IDialogTimeStamps | Dialog_TimestampsAttributes> {
    if (isEmpty(videoId)) throw new HttpException(400, 'videoId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findDialogTimestampsById: IDialogTimeStamps = await mongodbDialogTimestamps.findOne({ VideoVideoId: videoId });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
      return findDialogTimestampsById;
    } else {
      const findDialogTimestampsById: Dialog_TimestampsAttributes = await PostGres_Dialog_Timestamps.findOne({
        where: { VideoVideoId: videoId },
      });
      if (!findDialogTimestampsById) throw new HttpException(409, "Dialog Timestamp for this YouTube Video doesn't exist");
      return findDialogTimestampsById;
    }
  }
}

export default DialogTimestampsService;
