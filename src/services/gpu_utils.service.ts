import { logger } from '../utils/logger';
import sendEmail from '../utils/emailService';

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
}

export default GpuUtilsService;
