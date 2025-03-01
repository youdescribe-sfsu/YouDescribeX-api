import { logger } from '../utils/logger';
import sendEmail from '../utils/emailService';
import { getEmailForUser } from '../utils/util';
import { MongoAICaptionRequestModel, MongoUsersModel } from '../models/mongodb/init-models.mongo';
import { getVideoDataByYoutubeId } from '../utils/videos.util';

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
    if (!youtubeVideoData) throw new Error('notifyAiDescriptions: Video not found');

    const captionRequest = await MongoAICaptionRequestModel.findOne({ youtube_id: youtube_id });
    const userIds = captionRequest.caption_requests;

    const videoTitle = youtubeVideoData.title;
    const previewURL = `${ydx_app_host}/editor/${youtube_id}/${audio_description_id}`;
    const subject = `🎉 Audio Description Ready for "${videoTitle}"`;

    for (const user_id of userIds) {
      try {
        const email = await getEmailForUser(user_id.toString());
        const user = await MongoUsersModel.findById(user_id);
        const userName = user?.name || 'there';

        const text = `
            Dear ${userName},
            
            Great news! Your AI-generated audio description for "${videoTitle}" is now available.
            
            You can access and explore this description by following this link:
            ${previewURL}
            
            This description provides audio narration of visual elements, making the content more accessible. You can make any adjustments using our editor if needed.
            
            Thank you for being part of the YouDescribe community and helping make content more accessible for everyone!
            
            Best regards,
            The YouDescribe Team
                  `;

        logger.info(`Sending email to ${email.toString()}`);
        await sendEmail(email, subject, text);
        logger.info(`Email sent successfully to ${email}`);
      } catch (error) {
        logger.error(`Failed to send email to user ${user_id}: ${error.message}`);
      }
    }

    return { success: true, count: userIds.length };
  }
}

export default GpuUtilsService;
