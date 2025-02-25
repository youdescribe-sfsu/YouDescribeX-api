import { NextFunction, Request, Response } from 'express';
import AudioDescriptionsService from '../services/audioDescriptions.service';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';
import { MongoAICaptionRequestModel, MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import { logger } from '../utils/logger';
import { IUser } from '../models/mongodb/User.mongo';
import sendEmail from '../utils/emailService';

class AudioDescripionsController {
  public audioDescriptionsService = new AudioDescriptionsService();

  public getUserAudioDescriptionData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const audio_description_id: string = req.params.adId;
      // // console.log("audio_description_id", audio_description_id)
      const user = req.user as unknown as IUser;
      // console.log('user', user);
      if (!user) throw new Error('User not found');
      // const audio_description_id = req.headers.audiodescription as unknown as string;
      const userAudioDescriptions = await this.audioDescriptionsService.getUserAudioDescriptionData(videoId, user._id, audio_description_id);

      res.status(200).json(userAudioDescriptions);
    } catch (error) {
      next(error);
    }
  };

  public newAiDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newAiDescriptionData: NewAiDescriptionDto = req.body;
      const newAIDescription = await this.audioDescriptionsService.newAiDescription(newAiDescriptionData);
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

  public unpublishAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const {
        audioDescriptionId,
        youtube_id,
      }: {
        audioDescriptionId: string;
        youtube_id: string;
      } = req.body;
      if (!userData) throw new Error('User not found');
      if (!audioDescriptionId) throw new Error('Audio description id not found');
      if (!youtube_id) throw new Error('Video id not found');
      const publishedAudioDescription: string = await this.audioDescriptionsService.unpublishAudioDescription(audioDescriptionId, youtube_id, userData._id);

      res.status(200).json({ link: `${youtube_id}/${publishedAudioDescription}` });
    } catch (error) {
      next(error);
    }
  };

  public getAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audioDescriptionId: string = req.params.audioDescriptionId;
      const preview = req.query.preview as string;
      const audioDescription = await this.audioDescriptionsService.getAudioDescription(audioDescriptionId, preview === 'true');

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };

  public getMyDescriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.page;
      const paginate = req.query.paginate !== 'false';

      if (!userData) {
        throw new Error('User not logged in');
      }

      const audioDescription = await this.audioDescriptionsService.getMyDescriptions(userData._id, <string>pageNumber, paginate);

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };

  public getMyDraftDescriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.page;

      if (!userData) {
        throw new Error('User not logged in');
      }

      const audioDescription = await this.audioDescriptionsService.getMyDraftDescriptions(userData._id, <string>pageNumber);

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };

  public getAllAIDescriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.pageNumber;

      if (!userData) {
        throw new Error('User not logged in');
      }

      const audioDescription = await this.audioDescriptionsService.getAllAIDescriptions(userData._id, <string>pageNumber);

      res.status(200).json(audioDescription);
    } catch (error) {
      next(error);
    }
  };
}
export default AudioDescripionsController;
