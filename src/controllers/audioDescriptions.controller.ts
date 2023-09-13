import { NextFunction, Request, Response } from 'express';
import AudioDescriptionsService from '../services/audioDescriptions.service';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';
import { logger } from '../utils/logger';

class AudioDescripionsController {
  public audioDescriptionsService = new AudioDescriptionsService();

  public getUserAudioDescriptionData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const adId: string = req.params.adId;
      const userAudioDescriptions = await this.audioDescriptionsService.getUserAudioDescriptionData(videoId, adId);

      res.status(200).json(userAudioDescriptions);
    } catch (error) {
      next(error);
    }
  };

  public newAiDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newAiDescriptionData: NewAiDescriptionDto = req.body;
      const newAIDescription = await this.audioDescriptionsService.newAiDescription(newAiDescriptionData);
      const captionRequest = await MongoAICaptionRequestModel.findOne({
        youtube_id: newAiDescriptionData.youtube_id,
        ai_user_id: newAiDescriptionData.aiUserId,
      });
      if (captionRequest) {
        await MongoAICaptionRequestModel.updateOne(
          { _id: captionRequest._id }, // Assuming _id is the unique identifier for the document
          { $set: { status: 'completed' } },
        ).exec();
      }
      res.status(200).json(newAIDescription);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  };

  // public newDescription = async (req: Request, res: Response, next: NextFunction) => {
  //     Audio_Descriptions.create({});
  // };

  public deleteUserADAudios = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtube_video_id: string = req.params.youtubeVideoId;
      const adId: string = req.params.adId;

      const deletedUserADAudios: any = this.audioDescriptionsService.deleteUserADAudios(youtube_video_id, adId);

      res.status(200).json(deletedUserADAudios);
    } catch (error) {
      next(error);
    }
  };
}
export default AudioDescripionsController;
