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
      const enjoymentRating = req.body.enjoymentRating;
      const comment = req.body.comment;

      const { rating: newRating, overallRating } = await this.audioDescriptionRatingService.addRating(
        userId,
        audioDescriptionId,
        rating,
        feedback,
        enjoymentRating,
        comment,
      );

      // `overallRating` lets the client show the description's new average
      // without recomputing it, which is what used to drift on re-ratings.
      res.status(200).json({ result: newRating, overallRating });
    } catch (error) {
      next(error);
    }
  };

  public getUserRating = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query.userId as string;
      const audioDescriptionId = req.params.audioDescriptionId;

      const userRating = await this.audioDescriptionRatingService.getUserRating(userId, audioDescriptionId);

      res.status(200).json({ result: userRating });
    } catch (error) {
      next(error);
    }
  };
}

export default AudioDescriptionRatingController;
