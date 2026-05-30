import { CronJob } from 'cron';
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';
import GpuUtilsService from '../services/gpu_utils.service';
import { notifyAdmins } from './adminNotify.utils';
import { logger } from './logger';

// How long an AICaptionRequest may sit in `processing` before we consider the
// AI pipeline instance dead and fail the request out. The instance dying mid-job
// never sends a completion/failure callback, so the record would otherwise stay
// `processing` forever and wedge the queue (processNextInQueueLana bails while any
// record is `processing`). There is no heartbeat, so this must comfortably exceed
// the longest legitimate processing time.
const STALE_PROCESSING_MS = 5 * 60 * 60 * 1000; // 5 hours

/**
 * Find AICaptionRequest records stuck in `processing` past the timeout and fail
 * them out. Reuses GpuUtilsService.notifyAiDescriptionFailure, which emails every
 * requester and then deletes the record so the user can re-request (which creates
 * a fresh `pending`). Deleting the zombie also clears the queue's busy-check.
 */
export const sweepStuckAiCaptionRequests = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const stale = await MongoAICaptionRequestModel.find({ status: 'processing', updatedAt: { $lt: cutoff } }, { _id: 1, youtube_id: 1 });

  if (!stale.length) return;
  logger.info(`[sweeper] Found ${stale.length} AI caption request(s) stuck in processing > 5h`);

  const gpuUtils = new GpuUtilsService();
  const reaped: string[] = [];
  for (const rec of stale) {
    try {
      // Atomic claim: only the run that actually flips processing->failed proceeds,
      // so overlapping sweeps never email/delete the same record twice.
      const claimed = await MongoAICaptionRequestModel.updateOne({ _id: rec._id, status: 'processing' }, { $set: { status: 'failed' } });
      if (claimed.modifiedCount !== 1) continue;

      await gpuUtils.notifyAiDescriptionFailure(
        rec.youtube_id,
        'Processing timed out — the AI service did not respond within 5 hours. Please try requesting it again.',
      );
      reaped.push(rec.youtube_id);
      logger.info(`[sweeper] Failed out stuck request for ${rec.youtube_id}`);
    } catch (err: any) {
      logger.error(`[sweeper] Error failing out ${rec.youtube_id}: ${err?.message}`);
    }
  }

  // One summary alert to admins per run — a strong "the AI instance may have died" signal.
  if (reaped.length > 0) {
    await notifyAdmins(
      `[YDX] Swept ${reaped.length} stuck AI caption request(s)`,
      `${reaped.length} AI caption request(s) were stuck in 'processing' for over 5 hours and have been failed out ` +
        `(the AI pipeline instance may have died mid-job). Affected videos:\n${reaped.join('\n')}`,
    );
  }
};

// Run every 10 minutes (independent of the 5h staleness threshold). 6-field cron
// (sec min hour dom mon dow); started explicitly from app.ts.
export const stuckProcessingSweeperJob = new CronJob('0 */10 * * * *', sweepStuckAiCaptionRequests, null, false, 'America/Los_Angeles');
