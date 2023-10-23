import { NextFunction, Request, Response } from 'express';
import AudioDescriptionsService from '../services/audioDescriptions.service';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';
import { logger } from '../utils/logger';
import { IUser } from '../models/mongodb/User.mongo';

class AudioDescripionsController {
  public audioDescriptionsService = new AudioDescriptionsService();

  public getUserAudioDescriptionData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const userId: string = req.params.adId;
      const audio_description_id = req.headers.audiodescription as unknown as string;
      const userAudioDescriptions = await this.audioDescriptionsService.getUserAudioDescriptionData(videoId, userId, audio_description_id);

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

  public publishAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const {
        audioDescriptionId,
        youtube_id,
        enrolled_in_collaborative_editing = false,
      }: {
        audioDescriptionId: string;
        youtube_id: string;
        enrolled_in_collaborative_editing: boolean;
      } = req.body;
      const {} = req.body;
      if (!userData) throw new Error('User not found');
      if (!audioDescriptionId) throw new Error('Audio description id not found');
      if (!youtube_id) throw new Error('Video id not found');
      const publishedAudioDescription: string = await this.audioDescriptionsService.publishAudioDescription(
        audioDescriptionId,
        youtube_id,
        userData._id,
        enrolled_in_collaborative_editing,
      );

      res.status(200).json({ link: `${youtube_id}/${publishedAudioDescription}` });
    } catch (error) {
      next(error);
    }
  };

  public getAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audioDescriptionId: string = req.params.audioDescriptionId;
      const audioDescription = await this.audioDescriptionsService.getAudioDescription(audioDescriptionId);

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };

  public getRecentDescriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pageNumber = req.query.pageNumber as string;
      const audioDescription = await this.audioDescriptionsService.getRecentDescriptions(pageNumber);

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };
}
export default AudioDescripionsController;
