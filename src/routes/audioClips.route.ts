import { Router } from 'express';
import { upload } from '../utils/audioClips.util';
import { Routes } from '../interfaces/routes.interface';
import { AudioClipsController } from '../controllers/audioClips.controller';

class AudioClipsRoute implements Routes {
  public path = '/audio-clips';
  public router = Router();
  public audioClipController = new AudioClipsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/processAllClipsInDB/:adId`, this.audioClipController.processAllClipsInDB);
    this.router.put(`${this.path}/update-clip-title/:clipId`, this.audioClipController.updateAudioClipTitle);
    this.router.put(`${this.path}/update-clip-playback-type/:clipId`, this.audioClipController.updateAudioClipPlaybackType);
    this.router.put(`${this.path}/update-clip-start-time/:clipId`, this.audioClipController.updateAudioClipStartTime);
    this.router.put(`${this.path}/update-clip-description/:clipId`, this.audioClipController.updateAudioClipDescription);
    this.router.put(`${this.path}/record-replace-clip-audio/:clipId`, upload.single('file'), this.audioClipController.updateClipAudioPath);
    this.router.post(`${this.path}/add-new-clip/:adId`, upload.single('file'), this.audioClipController.addNewAudioClip);
    this.router.delete(`${this.path}/delete-clip/:clipId`, this.audioClipController.deleteAudioClip);
    this.router.post(`${this.path}/undo-last-deleted`, this.audioClipController.undoDeletedAudioClip);
  }
}

export default AudioClipsRoute;
