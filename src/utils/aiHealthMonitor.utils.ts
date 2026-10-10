import { CronJob } from 'cron';
import axios from 'axios';
import { notifyAdmins } from './adminNotify.utils';
import { logger } from './logger';

// undefined = not checked yet this process lifetime (no alert on the first check,
// since going from "unknown" to "healthy" isn't a recovery and going from "unknown"
// to "unhealthy" on startup shouldn't need a transition to already be useful — the
// very first failed check below still logs it, it just doesn't email until we know
// the previous state).
let previousHealthy: boolean | undefined;

/**
 * Polls the AI service's GET /health and emails admins only on a state
 * transition (healthy -> unhealthy or back), so a sustained outage sends one
 * "down" email and one "recovered" email instead of one every run.
 *
 * Replaces the old GPU_URL-based monitor removed in #114 (GPU_URL was never
 * set, so it always reported "down" and never fired a useful alert). This
 * checks AI_SERVICE_URL instead — the same env var the AI request sweeper and
 * /status already use to reach the live AI service.
 */
export const checkAiServiceHealth = async (): Promise<void> => {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  let healthy: boolean;
  try {
    // 30s: the AI service is single-process, so a synchronous burst (e.g. uploading
    // hundreds of keyframe images to S3 one at a time) blocks its event loop and
    // delays /health along with everything else. Measured one such burst at ~16s
    // (2026-09-07 outage false alarm) — 5s was tripping on normal processing, not
    // real downtime. A truly dead process still fails fast (connection refused),
    // so this only affects the "alive but busy" case.
    await axios.get(`${aiServiceUrl}/health`, { timeout: 30000 });
    healthy = true;
  } catch (err: any) {
    logger.warn(`[ai-health] GET ${aiServiceUrl}/health failed: ${err?.message}`);
    healthy = false;
  }

  if (previousHealthy !== undefined && healthy !== previousHealthy) {
    if (healthy) {
      await notifyAdmins('AI service recovered', `The AI service at ${aiServiceUrl} is responding to GET /health again.`);
    } else {
      await notifyAdmins(
        'AI service is DOWN',
        `The AI service at ${aiServiceUrl} stopped responding to GET /health. AI description requests will queue up until it's back.`,
      );
    }
  }

  previousHealthy = healthy;
};

// Every 5 minutes (6-field cron: sec min hour dom mon dow).
export const aiHealthCronJob = new CronJob(
  '0 */5 * * * *',
  checkAiServiceHealth,
  null, // onComplete
  false, // don't autostart — app.ts starts it explicitly alongside the other cron jobs
  'America/Los_Angeles',
);
