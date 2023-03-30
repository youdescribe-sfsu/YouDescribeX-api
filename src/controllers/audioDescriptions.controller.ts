import { NextFunction, Request, Response } from 'express';
import AudioDescriptionsService from '../services/audioDescriptions.service';
import { NewAiDescriptionDto } from '../dtos/audioDescriptions.dto';

class AudioDescripionsController {
  public audioDescriptionsService = new AudioDescriptionsService();

  public getUserAudioDescriptionData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId: string = req.params.videoId;
      const userId: string = req.params.userId;
      const userAudioDescriptions = await this.audioDescriptionsService.getUserAudioDescriptionData(videoId, userId);

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
      next(error);
    }
  };

  // public newDescription = async (req: Request, res: Response, next: NextFunction) => {
  //     Audio_Descriptions.create({});
  // };

  public deleteUserADAudios = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const youtube_video_id: string = req.params.youtubeVideoId;
      const userId: string = req.params.userId;

      const deletedUserADAudios: any = this.audioDescriptionsService.deleteUserADAudios(youtube_video_id, userId);

      res.status(200).json(deletedUserADAudios);
    } catch (error) {
      next(error);
    }
  };
}
export default AudioDescripionsController;
