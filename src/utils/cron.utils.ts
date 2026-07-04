import { CronJob } from 'cron';
import { logger } from './logger';
import { checkAndUpdateVideoStatuses } from './video-status.utils';

export const videoStatusCheckJob = new CronJob('0 0 * * *', async () => {
  logger.info('Starting scheduled video status check');
  const stats = await checkAndUpdateVideoStatuses();
  logger.info('Completed video status check', { totalVideosProcessed: stats.length });
});
