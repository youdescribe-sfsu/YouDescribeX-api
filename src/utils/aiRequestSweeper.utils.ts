import { CronJob } from 'cron';
import axios from 'axios';
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';
import GpuUtilsService from '../services/gpu_utils.service';
import { notifyAdmins } from './adminNotify.utils';
import { logger } from './logger';

// How long an AICaptionRequest may sit in `processing` before we get suspicious.
// This is only a "start checking" threshold, not a death sentence: a record past it
// is confirmed alive-or-dead against the AI /status endpoint below. A record still
// running there is left alone (the AI pipeline can legitimately run for hours on the
// CPU-only box). Must comfortably exceed the longest legitimate processing time.
const STALE_PROCESSING_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Find AICaptionRequest records stuck in `processing` past the timeout and, for the
 * ones the AI service is NOT actually running (per GET /status), fail them out.
 * Reuses GpuUtilsService.notifyAiDescriptionFailure, which emails every requester and
 * then deletes the record so the user can re-request (which creates a fresh `pending`).
 * Deleting the zombie also clears the queue's busy-check.
 */
export const sweepStuckAiCaptionRequests = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);

  const stale = await MongoAICaptionRequestModel.find({ status: 'processing', updatedAt: { $lt: cutoff } }, { _id: 1, youtube_id: 1 });

  if (!stale.length) return;
  logger.info(`[sweeper] Found ${stale.length} AI caption request(s) stuck in processing > 4h`);

  // Confirm liveness against the AI service before failing anything: /status reports the
  // video_ids it is really running (from the actual test_pipeline processes). If we can't
  // reach it, do NOT reap on a guess — skip this run; the next one (10 min later) retries.
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  let active: string[];
  try {
    const statusResp = await axios.get(`${aiServiceUrl}/status`, { timeout: 5000 });
    active = statusResp.data?.active ?? [];
  } catch (err: any) {
    logger.warn(`[sweeper] /status unreachable (${err?.message}); skipping this run.`);
    return;
  }

  const gpuUtils = new GpuUtilsService();
  const reaped: string[] = [];
  for (const rec of stale) {
    if (active.includes(rec.youtube_id)) continue; // AI is still running it — not dead

    try {
      // Atomic claim: only the run that actually flips processing->failed proceeds,
      // so overlapping sweeps never email/delete the same record twice.
      const claimed = await MongoAICaptionRequestModel.updateOne({ _id: rec._id, status: 'processing' }, { $set: { status: 'failed' } });
      if (claimed.modifiedCount !== 1) continue;

      await gpuUtils.notifyAiDescriptionFailure(
        rec.youtube_id,
        'Processing timed out — the AI service is no longer working on this video. Please try requesting it again.',
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
      `${reaped.length} AI caption request(s) were stuck in 'processing' past the timeout and are not running ` +
        `on the AI service (it may have died mid-job). They have been failed out. Affected videos:\n${reaped.join('\n')}`,
    );
  }
};

// Run every 10 minutes (independent of the staleness threshold). 6-field cron
// (sec min hour dom mon dow); started explicitly from app.ts.
export const stuckProcessingSweeperJob = new CronJob('0 */10 * * * *', sweepStuckAiCaptionRequests, null, false, 'America/Los_Angeles');
