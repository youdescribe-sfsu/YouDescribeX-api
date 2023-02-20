import { NextFunction, Request, Response } from 'express';
import { Dialog_TimestampsAttributes } from '../models/postgres/Dialog_Timestamps';
import DialogTimestampsService from '../services/dialogTimestamps.service';
import { IDialogTimeStamps } from '../interfaces/dialogTimestamps.interface';

class DialogTimestampsController {
  public dialogTimestampsService = new DialogTimestampsService();

  public getVideoDialogTimestamps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const videoDialogTimestamps: IDialogTimeStamps | Dialog_TimestampsAttributes = await this.dialogTimestampsService.getVideoDialogTimestamps(videoId);

      res.status(200).json(videoDialogTimestamps);
    } catch (error) {
      next(error);
    }
  };
}
export default DialogTimestampsController;
