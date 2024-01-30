import { NextFunction, Request, Response } from 'express';
import AudioDescriptionRatingService from '../services/audioDescriptionsRating.service';

class AudioDescriptionRatingController {
  public audioDescriptionRatingService = new AudioDescriptionRatingService();

  public addOne = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.body.userId;
      const audioDescriptionId = req.params.audioDescriptionId;
      const rating = req.body.rating;
      const feedback = req.body.feedback || [];

      const newRating = await this.audioDescriptionRatingService.addRating(userId, audioDescriptionId, rating, feedback);

      res.status(200).json({ result: newRating });
    } catch (error) {
      next(error);
    }
  };
}

export default AudioDescriptionRatingController;
