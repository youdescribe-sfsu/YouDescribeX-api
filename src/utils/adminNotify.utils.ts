import sendEmail from './emailService';
import { GPU_NOTIFY_EMAILS } from '../config';
import { logger } from './logger';

/**
 * Send an operational alert to the admin recipients (GPU_NOTIFY_EMAILS).
 * Best-effort: a failing recipient is logged and never throws, so callers
 * (cron jobs, the sweeper) can't be broken by an email failure.
 */
export const notifyAdmins = async (subject: string, text: string): Promise<void> => {
  await Promise.all(
    GPU_NOTIFY_EMAILS.map(email =>
      sendEmail(email, subject, text).catch((err: any) => logger.error(`[notifyAdmins] failed to email ${email}: ${err?.message}`)),
    ),
  );
};
