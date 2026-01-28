import { Router } from 'express';
import { upload } from '../utils/audioClips.util';
import { Routes } from '../interfaces/routes.interface';
import { AudioClipsController } from '../controllers/audioClips.controller';
import { trackContributions } from '../middlewares/trackContributions.middleware';

class AudioClipsRoute implements Routes {
  public path = '/audio-clips';
  public router = Router();
  public audioClipController = new AudioClipsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/processAllClipsInDB/:adId`, this.audioClipController.processAllClipsInDB);

    this.router.put(`${this.path}/update-clip-title/:clipId`, trackContributions(), this.audioClipController.updateAudioClipTitle);
    this.router.put(`${this.path}/update-clip-playback-type/:clipId`, trackContributions(), this.audioClipController.updateAudioClipPlaybackType);
    this.router.put(`${this.path}/update-clip-start-time/:clipId`, trackContributions(), this.audioClipController.updateAudioClipStartTime);
    this.router.put(`${this.path}/update-clip-description/:clipId`, trackContributions(), this.audioClipController.updateAudioClipDescription);
    this.router.put(
      `${this.path}/record-replace-clip-audio/:clipId`,
      upload.single('file'),
      trackContributions(),
      this.audioClipController.updateClipAudioPath,
    );
    this.router.post(`${this.path}/add-new-clip/:adId`, upload.single('file'), trackContributions(), this.audioClipController.addNewAudioClip);
    this.router.delete(`${this.path}/delete-clip/:clipId`, trackContributions(), this.audioClipController.deleteAudioClip);

    this.router.post(`${this.path}/undo-last-deleted`, this.audioClipController.undoDeletedAudioClip);
  }
}

export default AudioClipsRoute;
