import { NextFunction, Request, Response } from 'express';
import { Audio_DescriptionsAttributes } from '../models/postgres/Audio_Descriptions';
import AudioDescriptionsService from '../services/audioDescriptions.service';
import { IAudioDescriptions } from '../interfaces/audioDescriptions.interface';

class AudioDescripionsController {
    public audioDescriptionsService = new AudioDescriptionsService();
    
    public getUserAudioDescriptionData = async (req: Request, res: Response, next: NextFunction) => {

        try{
            const videoId: string = req.params.videoId;
            const userId: string = req.params.userId;
            const userAudioDescriptions: IAudioDescriptions | Audio_DescriptionsAttributes = await this.audioDescriptionsService.getUserAudioDescriptionData(videoId, userId);

            res.status(200).json(userAudioDescriptions);
        } catch (error) {
        next(error);
        }
    };

    public newAiDescription = async (req: Request, res: Response, next: NextFunction) => {
        
        try{
            const dialog = req.body.dialogue_timestamps;
            const audio_clips = req.body.audio_clips;
            const aiUserId = req.body.aiUserId || 'db72cc2a-b054-4b00-9f85-851b45649be0';
            const youtube_video_id = req.body.youtube_id;
            const video_name = req.body.video_name;
            const video_length = req.body.video_length;

            console.log(req.body);

            const newAIDescription: IAudioDescriptions | Audio_DescriptionsAttributes = await this.audioDescriptionsService.newAiDescription(dialog, audio_clips, aiUserId, youtube_video_id, video_name, video_length);
        
            res.status(200).json(newAIDescription);
        } catch (error) {
        next(error);
        }
    };

    // public newDescription = async (req: Request, res: Response, next: NextFunction) => {
    //     Audio_Descriptions.create({});
    // };

    public deleteUserADAudios = async (req: Request, res: Response, next: NextFunction) => {
        
        try{
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
