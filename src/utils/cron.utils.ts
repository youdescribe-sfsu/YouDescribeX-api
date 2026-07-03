import { CronJob } from 'cron';
import { checkGPUServerStatus } from './util';
import { logger } from './logger';
import { notifyAdmins } from './adminNotify.utils';
import { checkAndUpdateVideoStatuses } from './video-status.utils';
let previousStatus: any;
// Function to check GPU server status and send an email for status transitions
export const checkAndNotify = async (): Promise<void> => {
  const currentStatus = await checkGPUServerStatus();
  logger.info(`GPU Server Status :: ${currentStatus}`);
  console.log(`GPU Server Status :: ${currentStatus}`);
  if (previousStatus !== undefined && currentStatus !== previousStatus) {
    if (previousStatus === true && currentStatus === false) {
      await notifyAdmins('GPU Server is Down', 'YDX Server is unable to connect to the GPU server. Please check the GPU server.');
    } else {
      await notifyAdmins('GPU Server is Up', 'YDX Server is able to connect to the GPU server. GPU server is up and running.');
    }
  }

  previousStatus = currentStatus;
};
// Check the GPU server status every minute (6-field cron: sec min hour dom mon dow).
export const gpuStatusCronJob = new CronJob(
  '0 * * * * *', // every minute at second 0
  checkAndNotify, // Function to check and notify about GPU server status
  null, // onComplete
  true, // start the cron job immediately
  'America/Los_Angeles', // timeZone
);

export const videoStatusCheckJob = new CronJob('0 0 * * *', async () => {
  logger.info('Starting scheduled video status check');
  const stats = await checkAndUpdateVideoStatuses();
  logger.info('Completed video status check', { totalVideosProcessed: stats.length });
});
