import { logger } from '../utils/logger';
import sendEmail from '../utils/emailService';
import { getEmailForUser } from '../utils/util';
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';
import { getVideoDataByYoutubeId } from './videos.util';

class GpuUtilsService {
  public async notify(email: string, subject: string, text: string) {
    try {
      await sendEmail(email, subject, text);
      return `Email sent to ${email} successfully`;
    } catch (error) {
      logger.error(`Error Sending Email Due to Error :: ${JSON.stringify(error)} `);
      throw error;
    }
  }

  public async notifyAiDescriptions(youtube_id: string, audio_description_id: string, ydx_app_host: string, user_ids: string[]) {
    const youtubeVideoData = await getVideoDataByYoutubeId(youtube_id);
    if (!youtubeVideoData) throw new Error('notifyAiDescriptions :Video not found');
    const captionRequest = await MongoAICaptionRequestModel.findOne({ youtube_id: youtube_id });
    const userIds = captionRequest.caption_requests;

    const previewURL = `${ydx_app_host}/audio-description/preview/${youtube_id}/${audio_description_id}`;
    const subject = `Requested Audio Description for ${youtubeVideoData.title} ready`;
    const text = `Your AI prompted description is ready! You're invited to view it by following this link ${previewURL}`;
    for (const user_id of userIds) {
      const email = await getEmailForUser(user_id.toString());
      logger.info(`Sending email to ${email.toString()}`);
      await sendEmail(email, subject, text);
    }
  }
}

export default GpuUtilsService;
