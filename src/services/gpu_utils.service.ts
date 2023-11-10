import { logger } from '../utils/logger';
import sendEmail from '../utils/emailService';
import { getVideoDataByYoutubeId } from './videos.util';
import { getEmailForUser } from '../utils/util';

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
    const previewURL = `${ydx_app_host}/audio-description/preview/${youtube_id}/${audio_description_id}`;
    const subject = `Requested Audio Description for ${youtubeVideoData.title} ready`;
    const text = `Your AI prompted description is ready! You're invited to view it by following this link ${previewURL}`;
    for (const user_id of user_ids) {
      const email = await getEmailForUser(user_id);
      await sendEmail(email, subject, text);
    }
  }
}

export default GpuUtilsService;
