import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AddNewAudioClipDto, UpdateAudioClipDescriptionDto, UpdateAudioClipStartTimeDto, UpdateClipAudioPathDto } from '../dtos/audioClips.dto';
import AudioClipsService from '../services/audioClips.service';
import { processAllClipsInDBSession } from '../services/audiodescriptions.util';
import { startSession, ClientSession } from 'mongoose';

class AudioClipsController {
  public audioClipsService = new AudioClipsService();

  public processAllClipsInDB = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const audioDescriptionAdId: string = req.params.adId;

      const processedAudioClips = await processAllClipsInDBSession(audioDescriptionAdId, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(processedAudioClips);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public updateAudioClipTitle = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId: string = req.params.clipId;
      const adTitle: string = req.body.adTitle;

      const processedAudioClips = await this.audioClipsService.updateAudioClipTitle(clipId, adTitle, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(processedAudioClips);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public updateAudioClipPlaybackType = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId: string = req.params.clipId;
      const clipPlaybackType: string = req.body.clipPlaybackType;
      const updatedAudioClipType = await this.audioClipsService.updateAudioClipPlaybackType(clipId, clipPlaybackType, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(updatedAudioClipType);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public updateAudioClipStartTime = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId: string = req.params.clipId;
      const audioBody: UpdateAudioClipStartTimeDto = req.body;
      const updatedAudioClipStartTime = await this.audioClipsService.updateAudioClipStartTime(clipId, audioBody, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(updatedAudioClipStartTime);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public updateAudioClipDescription = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId: string = req.params.clipId;
      const audioBody: UpdateAudioClipDescriptionDto = req.body;
      const updatedAudioClipStartTime = await this.audioClipsService.updateAudioClipDescription(clipId, audioBody, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(updatedAudioClipStartTime);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public updateClipAudioPath = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId = req.params.clipId;
      const file = req.file;
      const audioBody: UpdateClipAudioPathDto = req.body;
      const updatedClipAudioPath = await this.audioClipsService.updateClipAudioPath(clipId, audioBody, file, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(updatedClipAudioPath);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public addNewAudioClip = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const adId = req.params.adId;
      const file = req.file;
      const audioBody: AddNewAudioClipDto = req.body;
      const addedAudioClip = await this.audioClipsService.addNewAudioClip(adId, audioBody, file, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(addedAudioClip);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };

  public deleteAudioClip = async (req: Request, res: Response, next: NextFunction) => {
    const session = await startSession();
    session.startTransaction();
    try {
      const clipId = req.params.clipId;
      const deletedAudioClip = await this.audioClipsService.deleteAudioClip(clipId, session);
      await session.commitTransaction();
      session.endSession();
      res.status(200).json(deletedAudioClip);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error(error);
      next(error);
    }
  };
}

export default AudioClipsController;
