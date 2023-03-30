import { NextFunction, Request, Response } from 'express';
import DialogTimestampsService from '../services/dialogTimestamps.service';

class DialogTimestampsController {
  public dialogTimestampsService = new DialogTimestampsService();

  public getVideoDialogTimestamps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const videoDialogTimestamps = await this.dialogTimestampsService.getVideoDialogTimestamps(videoId);

      res.status(200).json(videoDialogTimestamps);
    } catch (error) {
      next(error);
    }
  };
}
export default DialogTimestampsController;
