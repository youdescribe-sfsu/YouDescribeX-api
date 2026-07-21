import { Router } from 'express';
import { upload } from '../utils/audioClips.util';
import { Routes } from '../interfaces/routes.interface';
import { AudioClipsController } from '../controllers/audioClips.controller';
import authMiddleware from '../middlewares/auth.middleware'; // xiao: session guard for protected routes

class AudioClipsRoute implements Routes {
  public path = '/audio-clips';
  public router = Router();
  public audioClipController = new AudioClipsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}/processAllClipsInDB/:adId`, authMiddleware, this.audioClipController.processAllClipsInDB);
    this.router.put(`${this.path}/update-clip-title/:clipId`, authMiddleware, this.audioClipController.updateAudioClipTitle);
    this.router.put(`${this.path}/update-clip-playback-type/:clipId`, authMiddleware, this.audioClipController.updateAudioClipPlaybackType);
    this.router.put(`${this.path}/update-clip-start-time/:clipId`, authMiddleware, this.audioClipController.updateAudioClipStartTime);
    this.router.put(`${this.path}/update-clip-description/:clipId`, authMiddleware, this.audioClipController.updateAudioClipDescription);
    this.router.put(`${this.path}/record-replace-clip-audio/:clipId`, authMiddleware, upload.single('file'), this.audioClipController.updateClipAudioPath);
    this.router.post(`${this.path}/add-new-clip/:adId`, authMiddleware, upload.single('file'), this.audioClipController.addNewAudioClip);
    this.router.delete(`${this.path}/delete-clip/:clipId`, authMiddleware, this.audioClipController.deleteAudioClip);
    this.router.post(`${this.path}/undo-last-deleted`, authMiddleware, this.audioClipController.undoDeletedAudioClip);
    this.router.get(`${this.path}/get-playback-type/:clipId`, this.audioClipController.getAudioClipPlaybackType);
    this.router.post(`${this.path}/switch-to-tts/:clipId`, authMiddleware, this.audioClipController.switchToTTS);
  }
}

export default AudioClipsRoute;
