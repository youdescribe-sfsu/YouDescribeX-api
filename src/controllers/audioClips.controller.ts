import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import AudioClipsService from '../services/audioClips.service';
import { IUser } from '../models/mongodb/User.mongo';
import { MongoAudioClipsModel } from '../models/mongodb/init-models.mongo';

export class AudioClipsController {
  public audioClipsService = new AudioClipsService();

  public processAllClipsInDB = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audioDescriptionAdId: string = req.params.adId;
      const processedAudioClips = await this.audioClipsService.processAllClipsInDB(audioDescriptionAdId);
      res.status(200).json(processedAudioClips);
    } catch (error) {
      next(error);
    }
  };

  public updateAudioClipTitle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const adTitle: string = req.body.adTitle;
      const processedAudioClips = await this.audioClipsService.updateAudioClipTitle(clipId, adTitle);
      res.status(200).json(processedAudioClips);
    } catch (error) {
      next(error);
    }
  };

  public getAudioClipPlaybackType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const clip = await MongoAudioClipsModel.findById(clipId);

      if (!clip) {
        return res.status(404).json({ message: 'Audio clip not found' });
      }

      res.status(200).json({
        playback_type: clip.playback_type,
        message: 'Success',
      });
    } catch (error) {
      next(error);
    }
  };

  // Add this method to your AudioClipsController class
  public switchToTTS = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const { text, userId, youtubeVideoId, audioDescriptionId } = req.body;

      // Validate required parameters
      if (!text || !userId || !youtubeVideoId || !audioDescriptionId) {
        return res.status(400).json({
          message: 'Missing required parameters: text, userId, youtubeVideoId, audioDescriptionId',
        });
      }

      const result = await this.audioClipsService.switchToTTS(clipId, text, userId, youtubeVideoId, audioDescriptionId);

      res.status(200).json(result);
    } catch (error) {
      logger.error('Switch to TTS controller error:', error);
      next(error);
    }
  };

  public updateAudioClipPlaybackType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const clipPlaybackType: string = req.body.clipPlaybackType;
      const updatedAudioClipType = await this.audioClipsService.updateAudioClipPlaybackType(clipId, clipPlaybackType);
      res.status(200).json(updatedAudioClipType);
    } catch (error) {
      next(error);
    }
  };

  public updateAudioClipStartTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const audioBody: UpdateAudioClipStartTimeDto = req.body;
      const updatedAudioClipStartTime = await this.audioClipsService.updateAudioClipStartTime(clipId, audioBody);
      res.status(200).json(updatedAudioClipStartTime);
    } catch (error) {
      next(error);
    }
  };

  public updateAudioClipDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId: string = req.params.clipId;
      const audioBody: UpdateAudioClipDescriptionDto = req.body;
      const updatedAudioClipStartTime = await this.audioClipsService.updateAudioClipDescription(clipId, audioBody);
      res.status(200).json(updatedAudioClipStartTime);
    } catch (error) {
      next(error);
    }
  };

  public updateClipAudioPath = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId = req.params.clipId;
      const file = req.file;
      const audioBody: UpdateClipAudioPathDto = req.body;
      const updatedClipAudioPath = await this.audioClipsService.updateClipAudioPath(clipId, audioBody, file);
      res.status(200).json(updatedClipAudioPath);
    } catch (error) {
      next(error);
    }
  };

  public addNewAudioClip = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adId = req.params.adId;
      const file = req.file;
      const audioBody: AddNewAudioClipDto = req.body;
      const addedAudioClip = await this.audioClipsService.addNewAudioClip(adId, audioBody, file);
      res.status(200).json(addedAudioClip);
    } catch (error) {
      next(error);
    }
  };

  public deleteAudioClip = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clipId = req.params.clipId;
      const userData = req.user as unknown as IUser;
      const videoId = req.query.youtubeVideoId;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const deletedAudioClip = await this.audioClipsService.deleteAudioClip(clipId, userData._id, <string>videoId);
      res.status(200).json(deletedAudioClip);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  };

  public undoDeletedAudioClip = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const videoId = req.body.youtubeVideoId;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const restoredClip = await this.audioClipsService.undoDeletedAudioClip(userData._id, videoId);
      if (restoredClip) {
        res.status(200).json({ message: 'Audio clip restored successfully', clip: restoredClip });
      } else {
        res.status(400).json({ message: 'No clips to undo' });
      }
    } catch (error) {
      logger.error(error);
      next(error);
    }
  };
}
