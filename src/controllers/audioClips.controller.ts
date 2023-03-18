import { NextFunction, Request, Response } from 'express';
import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import AudioClipsService from '../services/audioClips.service';

class AudioClipsController {
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
      const addedAudioClip = await this.audioClipsService.deleteAudioClip(clipId);
      res.status(200).json(addedAudioClip);
    } catch (error) {
      console.log('error', error);
      next(error);
    }
  };
}
export default AudioClipsController;
