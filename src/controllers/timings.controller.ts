import { NextFunction, Request, Response } from 'express';
import { AddTotalTimeDto } from '../dtos/timings.dto';
import TimingsService from '../services/timings.service';

class TimingsController {
  public timingsService = new TimingsService();

  public addTotalTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timingBody: AddTotalTimeDto = req.body;
      const videoByYoutubeID = await this.timingsService.addTotalTime(timingBody);
      res.status(201).json({ ...videoByYoutubeID });
    } catch (error) {
      next(error);
    }
  };
}

export default TimingsController;
