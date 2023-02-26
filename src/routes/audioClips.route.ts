import { Router } from 'express';
import { upload } from '../services/audioClips.util';
import AudioClipsController from '../controllers/audioClips.controller';
import { Routes } from '../interfaces/routes.interface';

class AudioClipsRoute implements Routes {
  public path = '/audio-clips';
  public router = Router();
  public audioClipController = new AudioClipsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/processAllClipsInDB/:adId'`, this.audioClipController.processAllClipsInDB);
    this.router.put(`${this.path}/update-clip-title/:clipId`, this.audioClipController.updateAudioClipTitle);
    this.router.put(`${this.path}/update-clip-playback-type/:clipId`, this.audioClipController.updateAudioClipPlaybackType);
    this.router.put(`${this.path}/update-clip-start-time/:clipId`, this.audioClipController.updateAudioClipStartTime);
    this.router.put(`${this.path}/update-clip-description/:clipId`, this.audioClipController.updateAudioClipDescription);

    this.router.put(`${this.path}/record-replace-clip-audio/:clipId`, upload.single('file'), this.audioClipController.updateClipAudioPath);

    this.router.post(`${this.path}/record-replace-clip-audio/:adId`, upload.single('file'), this.audioClipController.addNewAudioClip);

    this.router.delete(`${this.path}/delete-clip/:clipId`, this.audioClipController.deleteAudioClip);
  }
}

export default AudioClipsRoute;
