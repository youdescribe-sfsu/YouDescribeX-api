# AI Pipeline Concurrency + Videos-Ahead Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the AI pipeline dispatch cap from 1 → configurable (default 2) so multiple Gemini-backed pipeline jobs can run in parallel, with overflow waiting in the existing queue; the initial "request received" email now tells the user how many videos are ahead of theirs.

**Architecture:** Single source of truth for in-flight count stays in MongoDB (`MongoAICaptionRequestModel.status='processing'`). The Node.js `users.service.ts` reads the count, dispatches up to `AI_PIPELINE_CONCURRENCY` items per scheduler tick, and computes `videosAhead = queueAhead + currentlyProcessing` at email time. The Python AI service (`AI-generated-AD/server.py`, `zhenzhen-dev`) adds an `asyncio.Semaphore` as defense-in-depth and returns 503 if asked to start a pipeline at cap.

**Tech Stack:** Node.js + TypeScript + Express + Jest (api side); Python 3 + FastAPI + asyncio + pytest (AI side).

**Spec:** `docs/superpowers/specs/2026-06-12-ai-pipeline-concurrency-design.md`

---

## File Map

**Modify (api repo, branch `dev`):**
- `src/config/index.ts` — add `AI_PIPELINE_CONCURRENCY` env var (parse, default 2)
- `src/services/users.service.ts` — refactor `processNextInQueueLana`, add `recoverStaleProcessing`, add `computeVideosAhead`; update `performImmediateOperations` + `getNewAudioDescriptionEmailBody` signature/body; remove `isProcessingQueue` flag in favor of `isDispatching`

**Create (api repo):**
- `src/tests/users.queue.test.ts` — unit tests for `computeVideosAhead` + `getNewAudioDescriptionEmailBody` text + concurrency-aware dispatch

**Modify (docs repo):**
- `env-templates/api.env.template` — document `AI_PIPELINE_CONCURRENCY`

**Modify (AI repo, branch `zhenzhen-dev`):**
- `server.py` — module-level `MAX_CONCURRENT_PIPELINES`, `pipeline_semaphore`, non-blocking acquire in `/api/generate-ai-description`, release in `run_pipeline_and_forward`
- `.env.example` — document `MAX_CONCURRENT_PIPELINES`

**Create (AI repo):**
- `test_concurrency.py` — pytest covering the 503 path and semaphore release

---

## Working directory expectations

All `git` commands assume cwd starts at `/Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-api` unless explicitly cd'd. Both branches should already be checked out: api `dev`, AI `zhenzhen-dev`. Verify before starting:

```bash
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-api && git rev-parse --abbrev-ref HEAD   # expect: dev
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD && git rev-parse --abbrev-ref HEAD   # expect: zhenzhen-dev
```

---

## Task 1: Add `AI_PIPELINE_CONCURRENCY` to api config

**Files:**
- Modify: `src/config/index.ts`

- [ ] **Step 1: Add field to `AppConfig` interface**

In `src/config/index.ts`, find the `AppConfig` interface (around line 89). Add the new field:

```ts
interface AppConfig {
  ttsEngine: string;
  nodeEnv: string;
  audioDirectory: string;
  aiUserId: string;
  aiPipelineConcurrency: number;   // <-- ADD THIS LINE
  currentYdxHost: string | undefined;
  email: {
    user: string | undefined;
    password: string | undefined;
  };
  openai: {
    apiKey: string | undefined;
  };
}
```

- [ ] **Step 2: Populate `CONFIG.app`**

In the `CONFIG.app` block (around line 180), add the parsed env var. Insert after `aiUserId`:

```ts
  app: {
    nodeEnv: ENV.nodeEnv,
    audioDirectory: process.env.AUDIO_DIRECTORY || '/public/audio',
    aiUserId: process.env.AI_USER_ID || '650506db3ff1c2140ea10ece',
    aiPipelineConcurrency: parseInt(process.env.AI_PIPELINE_CONCURRENCY || '2', 10),   // <-- ADD
    currentYdxHost: process.env.CURRENT_YDX_HOST,
    email: { ... },
    ...
  } as AppConfig,
```

- [ ] **Step 3: Add to the named exports**

Locate the `export const { ... } = { ... }` block at the bottom of the file (lines 251–333). Add `AI_PIPELINE_CONCURRENCY` to the destructured list AND to the object literal:

```ts
export const {
  ...
  AI_USER_ID,
  AI_PIPELINE_CONCURRENCY,   // <-- ADD
  GMAIL_USER,
  ...
} = {
  ...
  AI_USER_ID: CONFIG.app.aiUserId,
  AI_PIPELINE_CONCURRENCY: CONFIG.app.aiPipelineConcurrency,   // <-- ADD
  GMAIL_USER: CONFIG.app.email.user,
  ...
};
```

- [ ] **Step 4: Type-check compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. (Pre-existing warnings are fine.)

- [ ] **Step 5: Commit**

```bash
git add src/config/index.ts
git commit -m "config: add AI_PIPELINE_CONCURRENCY env var (default 2)"
```

---

## Task 2: Write failing tests for `computeVideosAhead` and email body

**Files:**
- Create: `src/tests/users.queue.test.ts`

This task writes the test first; the implementation follows in Tasks 3 and 4.

- [ ] **Step 1: Create the test file with failing tests**

```ts
// src/tests/users.queue.test.ts
import UserService from '../services/users.service';

// We use the private method via bracket access on an instance.
// This is intentional — the queue logic is a private implementation detail
// of UserService, but the math is worth unit-testing directly.

afterAll(async () => {
  await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
});

describe('UserService.computeVideosAhead', () => {
  it('returns 0 when queue is empty and nothing is processing', () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [];
    expect(svc.computeVideosAhead(0)).toBe(0);
  });

  it('returns processing count when this is the first queued item', () => {
    const svc = new UserService() as any;
    // The queue length AT email time is 1 (just-pushed item is the only one).
    svc.videoProcessingQueue = [{ youtubeId: 'a', userId: 'u', aiUserId: 'ai', ydx_app_host: '' }];
    // 2 already processing → 2 ahead, just-pushed is at position 1.
    expect(svc.computeVideosAhead(2)).toBe(2);
  });

  it('counts queue items ahead AND currently processing', () => {
    const svc = new UserService() as any;
    // 3 items in queue: a, b, c (we are c, just pushed).
    svc.videoProcessingQueue = [
      { youtubeId: 'a', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'b', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'c', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
    ];
    // 2 processing + 2 queue items ahead of us = 4
    expect(svc.computeVideosAhead(2)).toBe(4);
  });
});

describe('UserService.getNewAudioDescriptionEmailBody', () => {
  const svc = new UserService() as any;

  it('says "next in line" when videosAhead is 0', () => {
    const body: string = svc.getNewAudioDescriptionEmailBody('Alex', 'My Test Video', 0, 0);
    expect(body).toContain('Alex');
    expect(body).toContain('My Test Video');
    expect(body).toMatch(/next in line/i);
    expect(body).not.toMatch(/video\(s\) ahead/i);
  });

  it('includes the videosAhead count when greater than 0', () => {
    const body: string = svc.getNewAudioDescriptionEmailBody('Alex', 'My Test Video', 3, 2);
    expect(body).toContain('3 video');
    expect(body).toMatch(/2 being processed/);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/tests/users.queue.test.ts`
Expected: tests fail because `computeVideosAhead` does not exist yet and the email body signature only accepts 2 args.

- [ ] **Step 3: Commit failing tests**

```bash
git add src/tests/users.queue.test.ts
git commit -m "test: add failing tests for queue concurrency helpers"
```

---

## Task 3: Implement `computeVideosAhead` and update `getNewAudioDescriptionEmailBody`

**Files:**
- Modify: `src/services/users.service.ts`

- [ ] **Step 1: Import the new env var**

In `src/services/users.service.ts`, find the existing import line:

```ts
import { CURRENT_DATABASE, CURRENT_YDX_HOST, GPU_URL, AI_USER_ID } from '../config';
```

Replace with:

```ts
import { CURRENT_DATABASE, CURRENT_YDX_HOST, GPU_URL, AI_USER_ID, AI_PIPELINE_CONCURRENCY } from '../config';
```

- [ ] **Step 2: Add `computeVideosAhead` private method**

Insert this private method inside the `UserService` class, right above `performImmediateOperations` (around line 663):

```ts
  private computeVideosAhead(currentlyProcessing: number): number {
    // The just-pushed item is at the back of the queue.
    // Items ahead = (queue length - 1), clamped to 0.
    const inQueueAhead = Math.max(0, this.videoProcessingQueue.length - 1);
    return inQueueAhead + currentlyProcessing;
  }
```

- [ ] **Step 3: Update `getNewAudioDescriptionEmailBody` signature and body**

Find the method (around line 908). Replace the full method with:

```ts
  private getNewAudioDescriptionEmailBody(userName: string, videoTitle: string, videosAhead: number, currentlyProcessing: number) {
    const queueLine =
      videosAhead === 0
        ? `Your video is next in line — processing will start shortly.`
        : `There are currently ${videosAhead} video(s) ahead of yours in the queue (${currentlyProcessing} being processed right now).`;

    return `
      Dear ${userName},

      Great news! We've received your request for an AI-generated audio description of "${videoTitle}". Our advanced AI is now hard at work crafting a detailed and engaging description just for you.

      Here's what's happening:

      - Our AI is analyzing the video content
      - It's identifying key visual elements and actions
      - Soon, it will generate a comprehensive audio description

      ${queueLine}

      We'll notify you as soon as your AI-enhanced audio description is ready to explore. This may take some time, depending on the video's length and complexity.

      In the meantime, why not explore other audio-described videos on YouDescribe? There's always something new to discover!

      Thank you for your patience and for being a valued member of the YouDescribe community. Your request helps us improve our AI and make more content accessible to everyone.

      Stay tuned for your enhanced viewing experience!

      Best regards,
      The YouDescribe Team
        `;
  }
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/tests/users.queue.test.ts`
Expected: all 5 tests in `users.queue.test.ts` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/users.service.ts
git commit -m "feat(api): add computeVideosAhead helper and length-aware email body"
```

---

## Task 4: Wire `computeVideosAhead` into `performImmediateOperations`

**Files:**
- Modify: `src/services/users.service.ts`

- [ ] **Step 1: Import `MongoAICaptionRequestModel` (already imported — verify)**

Confirm the existing import block already includes `MongoAICaptionRequestModel`. Run:

```bash
grep -n "MongoAICaptionRequestModel" src/services/users.service.ts | head -3
```

Expected: at least one match in the import section near line 9–15. If missing, add it.

- [ ] **Step 2: Replace `performImmediateOperations` body**

Find `performImmediateOperations` (around line 663). Replace with:

```ts
  private async performImmediateOperations(userData: IUser, youtube_id: string, ydx_app_host: string, youtubeVideoData: any): Promise<void> {
    try {
      // Increment counter in database
      await this.increaseRequestCount(youtube_id, userData._id.toString(), AI_USER_ID);

      // Count currently in-flight pipelines (status='processing') for the email
      const currentlyProcessing = await MongoAICaptionRequestModel.countDocuments({ status: 'processing' });
      const videosAhead = this.computeVideosAhead(currentlyProcessing);

      // Send initial notification email to user (includes queue position info)
      await sendEmail(
        userData.email,
        `🎬 AI Description for "${youtubeVideoData.title}" is in the Works!`,
        this.getNewAudioDescriptionEmailBody(userData.name, youtubeVideoData.title, videosAhead, currentlyProcessing),
      );

      logger.info(`Immediate operations completed for video ${youtube_id}, user ${userData._id} (videosAhead=${videosAhead}, processing=${currentlyProcessing})`);
    } catch (error: any) {
      logger.error(`Error in immediate operations for ${youtube_id}: ${error.message}`);
      throw error;
    }
  }
```

**Important:** `performImmediateOperations` is called from `queueVideoForProcessing` (line 632) BEFORE `videoProcessingQueue.push(...)`. We need the push to happen FIRST so the just-pushed item is included in the queue length used by `computeVideosAhead`. See Step 3.

- [ ] **Step 3: Reorder operations in `queueVideoForProcessing`**

Find `queueVideoForProcessing` (around line 627). Move the `videoProcessingQueue.push` BEFORE `performImmediateOperations`:

```ts
  private async queueVideoForProcessing(userData: IUser, youtube_id: string, ydx_app_host: string, youtubeVideoData: any): Promise<any> {
    try {
      logger.info(`Adding video ${youtube_id} to processing queue for user ${userData._id}`);

      // Add to queue FIRST so videosAhead math in performImmediateOperations sees this item
      this.videoProcessingQueue.push({
        youtubeId: youtube_id,
        userId: userData._id.toString(),
        aiUserId: AI_USER_ID,
        ydx_app_host,
      });

      // Now do the immediate operations (db counter + email). Email reads queue state.
      await this.performImmediateOperations(userData, youtube_id, ydx_app_host, youtubeVideoData);

      // Kick off dispatcher (it's idempotent — self-guards against re-entry)
      this.processNextInQueueLana();

      return {
        message: 'Your request has been queued and will be processed in order',
        status: 'pending',
        queuePosition: this.videoProcessingQueue.length,
      };
    } catch (error: any) {
      logger.error(`Error queuing video ${youtube_id}: ${error.message}`, {
        userId: userData._id,
        error: error,
      });
      throw error;
    }
  }
```

(The change vs. existing code: queue push moves above `performImmediateOperations`, and the `if (!this.isProcessingQueue)` check is dropped — `processNextInQueueLana` will self-guard once we refactor it in Task 5.)

- [ ] **Step 4: Type-check compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/users.service.ts
git commit -m "feat(api): include videosAhead and currentlyProcessing in initial email"
```

---

## Task 5: Refactor `processNextInQueueLana` to concurrency-aware dispatch

**Files:**
- Modify: `src/services/users.service.ts`

- [ ] **Step 1: Rename in-flight flag**

Find the class field around line 37:

```ts
  private isProcessingQueue = false;
```

Replace with:

```ts
  private isDispatching = false;
```

- [ ] **Step 2: Add `recoverStaleProcessing` helper**

Insert this private method directly above `processNextInQueueLana` (around line 685):

```ts
  private async recoverStaleProcessing(): Promise<void> {
    const staleThreshold = new Date(Date.now() - UserService.STALE_PROCESSING_TIMEOUT_MS);
    const staleRecords = await MongoAICaptionRequestModel.find({
      status: 'processing',
      updatedAt: { $lt: staleThreshold },
    });

    for (const record of staleRecords) {
      const staleDuration = Date.now() - new Date((record as any).updatedAt).getTime();
      logger.warn(`Stale processing detected for ${record.youtube_id} (stuck for ${Math.round(staleDuration / 60000)} min). Marking as failed.`);
      await MongoAICaptionRequestModel.updateOne({ _id: record._id }, { $set: { status: 'failed' } });
      const gpuUtils = new GpuUtilsService();
      await gpuUtils.notifyAiDescriptionFailure(
        record.youtube_id,
        'The processing timed out. The server may have been busy or encountered an error.',
      );
    }
  }
```

- [ ] **Step 3: Replace `processNextInQueueLana` body**

Find `processNextInQueueLana` (around line 685) and replace the entire method with:

```ts
  //******** LANA CHANGE *********/
  private async processNextInQueueLana(): Promise<void> {
    // Re-entry guard: only one dispatch loop active at a time.
    if (this.isDispatching) return;
    if (this.videoProcessingQueue.length === 0) return;

    this.isDispatching = true;
    try {
      // 1. Recover any stale 'processing' records so they don't permanently block dispatch.
      await this.recoverStaleProcessing();

      // 2. Read in-flight count. This is the source of truth — survives api restarts.
      let inFlight = await MongoAICaptionRequestModel.countDocuments({ status: 'processing' });

      // 3. Dispatch as many items as slots allow.
      while (this.videoProcessingQueue.length > 0 && inFlight < AI_PIPELINE_CONCURRENCY) {
        const nextItem = this.videoProcessingQueue[0];

        // Skip items whose video has already been completed (e.g. by a parallel path).
        const currentVideoStatus = await MongoAICaptionRequestModel.findOne({
          youtube_id: nextItem.youtubeId,
          ai_user_id: nextItem.aiUserId,
        });
        if (currentVideoStatus?.status === 'completed') {
          logger.info(`Video ${nextItem.youtubeId} already completed. Skipping.`);
          this.videoProcessingQueue.shift();
          continue;
        }

        const user = await MongoUsersModel.findById(nextItem.userId);
        if (!user) {
          logger.warn(`User ${nextItem.userId} not found for queued video ${nextItem.youtubeId}; dropping.`);
          this.videoProcessingQueue.shift();
          continue;
        }

        logger.info(`Dispatching ${nextItem.youtubeId} to AI service (inFlight=${inFlight}/${AI_PIPELINE_CONCURRENCY})`);

        await MongoAICaptionRequestModel.updateOne(
          { youtube_id: nextItem.youtubeId, ai_user_id: nextItem.aiUserId },
          { $set: { status: 'processing' } },
          { upsert: true },
        );

        try {
          await this.sendToApiService(user, nextItem.youtubeId, nextItem.aiUserId);
          this.videoProcessingQueue.shift();
          inFlight++;
        } catch (dispatchErr: any) {
          // If the AI service returned 503 (busy) or anything else, roll back and stop this tick.
          logger.warn(`Dispatch failed for ${nextItem.youtubeId}: ${dispatchErr.message}. Will retry next tick.`);
          await MongoAICaptionRequestModel.updateOne(
            { youtube_id: nextItem.youtubeId, ai_user_id: nextItem.aiUserId },
            { $set: { status: 'failed' } },
          );
          const gpuUtils = new GpuUtilsService();
          await gpuUtils.notifyAiDescriptionFailure(nextItem.youtubeId, 'An error occurred while dispatching your request.');
          this.videoProcessingQueue.shift();
          break;
        }
      }
    } catch (error: any) {
      logger.error(`Error in queue dispatcher: ${error.message}`);
    } finally {
      this.isDispatching = false;
    }

    // Re-schedule a tick if there's more work and we're capacity-bound.
    if (this.videoProcessingQueue.length > 0) {
      setTimeout(() => this.processNextInQueueLana(), 5000);
    }
  }
```

- [ ] **Step 4: Remove the obsolete `processNextInQueue` (non-Lana) method if present**

Run:

```bash
grep -n "private async processNextInQueue\b" src/services/users.service.ts
```

If there's a second method `processNextInQueue` (non-Lana variant, originally at lines 764+), confirm it is not called anywhere. Search:

```bash
grep -n "processNextInQueue\b" src/services/users.service.ts
```

If the only references are its own definition and an already-commented-out call, **leave it alone** (out of scope — don't expand the change). If it's actively called somewhere we modified, raise it and stop.

- [ ] **Step 5: Update the `checkAIServiceAvailability` reported `queueSize`**

The method at line 508 still uses `this.videoProcessingQueue.length`. Verify it's still meaningful — no change required. Skip if unchanged.

- [ ] **Step 6: Add a concurrency-gate test**

Append to `src/tests/users.queue.test.ts`:

```ts
import { MongoAICaptionRequestModel } from '../models/mongodb/init-models.mongo';

describe('UserService.processNextInQueueLana — concurrency gate', () => {
  it('does not dispatch when inFlight >= AI_PIPELINE_CONCURRENCY', async () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [
      { youtubeId: 'vid1', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
    ];

    // Pretend 2 are already processing (default cap is 2).
    (MongoAICaptionRequestModel as any).countDocuments = jest.fn().mockResolvedValue(2);
    (MongoAICaptionRequestModel as any).find = jest.fn().mockResolvedValue([]); // no stale
    const sendSpy = jest.spyOn(svc, 'sendToApiService').mockResolvedValue(undefined);

    await svc.processNextInQueueLana();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(svc.videoProcessingQueue.length).toBe(1); // unchanged
  });

  it('dispatches up to AI_PIPELINE_CONCURRENCY items in a single tick when slots are free', async () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [
      { youtubeId: 'vid1', userId: 'u1', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'vid2', userId: 'u2', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'vid3', userId: 'u3', aiUserId: 'ai', ydx_app_host: '' },
    ];

    // No one is processing yet.
    (MongoAICaptionRequestModel as any).countDocuments = jest.fn().mockResolvedValue(0);
    (MongoAICaptionRequestModel as any).find = jest.fn().mockResolvedValue([]);
    (MongoAICaptionRequestModel as any).findOne = jest.fn().mockResolvedValue(null);
    (MongoAICaptionRequestModel as any).updateOne = jest.fn().mockResolvedValue({});
    // MongoUsersModel.findById should return a truthy user; mock minimally.
    const { MongoUsersModel } = require('../models/mongodb/init-models.mongo');
    (MongoUsersModel as any).findById = jest.fn().mockResolvedValue({ _id: 'u1', email: 'x@y.z' });

    const sendSpy = jest.spyOn(svc, 'sendToApiService').mockResolvedValue(undefined);

    await svc.processNextInQueueLana();

    // Default AI_PIPELINE_CONCURRENCY is 2 → exactly 2 dispatches, 1 left in queue.
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(svc.videoProcessingQueue.length).toBe(1);
    expect(svc.videoProcessingQueue[0].youtubeId).toBe('vid3');
  });
});
```

- [ ] **Step 7: Run tests — expect PASS**

Run: `npm test -- src/tests/users.queue.test.ts`
Expected: 7 tests pass total (5 from Task 2 + 2 new).

If `AI_PIPELINE_CONCURRENCY` differs from 2 in the test env, set it for the test run: `AI_PIPELINE_CONCURRENCY=2 npm test -- src/tests/users.queue.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/services/users.service.ts src/tests/users.queue.test.ts
git commit -m "feat(api): concurrency-aware AI pipeline dispatcher (AI_PIPELINE_CONCURRENCY)"
```

---

## Task 6: Document the env var in the docs repo

**Files:**
- Modify: `/Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-docs/env-templates/api.env.template`

- [ ] **Step 1: Add a section to the api env template**

Append (or insert next to other AI/GPU vars) the following block:

```bash
# ---- AI pipeline concurrency ----
# Maximum simultaneous AI pipeline jobs (m5.large: keep at 2; raise after EC2 upgrade)
AI_PIPELINE_CONCURRENCY=2
```

- [ ] **Step 2: Commit in the docs repo**

```bash
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-docs
git add env-templates/api.env.template
git commit -m "env: document AI_PIPELINE_CONCURRENCY"
cd -
```

(Working dir returns to the api repo for subsequent tasks.)

---

## Task 7: AI service — semaphore-gated `/api/generate-ai-description`

**Files:**
- Modify: `/Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD/server.py`

- [ ] **Step 1: cd to AI repo and confirm branch**

```bash
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD
git rev-parse --abbrev-ref HEAD   # expect: zhenzhen-dev
git status -sb                    # expect: clean
```

- [ ] **Step 2: Add module-level semaphore**

In `server.py`, find the existing imports (top of file) and confirm `os` and `asyncio` are already imported. Then find the `app = FastAPI()` line (around line 29). Insert immediately after it:

```python
# Concurrency cap (defense-in-depth — the api is the primary scheduler).
# Default 2 matches AI_PIPELINE_CONCURRENCY on the api side for m5.large.
MAX_CONCURRENT_PIPELINES = int(os.getenv("MAX_CONCURRENT_PIPELINES", "2"))
pipeline_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PIPELINES)
```

- [ ] **Step 3: Update `/api/generate-ai-description` to acquire the semaphore non-blockingly**

Find the route handler `narration_bot` (search: `def narration_bot`). Replace the entire handler with:

```python
@app.post("/api/generate-ai-description")
async def narration_bot(data: UnifiedVideoRequest, background_tasks: BackgroundTasks):
    logger.info(f"Received narration bot request: {data}")

    video_id = data.youtube_id

    # Reject duplicate requests for the same video that's already processing
    if video_id in pipeline_status and pipeline_status[video_id]["status"] == "processing":
        return {
            "status": "already_processing",
            "message": f"Pipeline already running for {video_id}. Check /api/pipeline-status/{video_id}",
        }

    pattern = os.path.join("videos", video_id, "final_data*.json")

    # Already-have-results path: forward existing, don't acquire a slot.
    if glob.glob(pattern):
        logger.info(f"File {pattern} exists. Skipping pipeline and JUMPING to forwarding.")
        background_tasks.add_task(forward_final_data, data)
        return {
            "status": "already_exists",
            "message": "Video found. Forwarding existing data now."
        }

    # Try to acquire a pipeline slot without blocking the request.
    try:
        await asyncio.wait_for(pipeline_semaphore.acquire(), timeout=0)
    except asyncio.TimeoutError:
        logger.warning(f"Pipeline at capacity ({MAX_CONCURRENT_PIPELINES}); rejecting {video_id} with 503")
        return JSONResponse(
            status_code=503,
            content={"status": "busy", "message": "AI pipeline at capacity. Please retry."},
        )

    # Slot acquired — schedule the pipeline. The handler releases the slot in its finally block.
    background_tasks.add_task(
        run_pipeline_and_forward,
        video_id,
        data.user_id,
        data.ai_user_id,
        data.data_type,
        data.s3_video_path,
        data.s3_metadata_path,
    )

    return {
        "status": "processing",
        "message": f"Pipeline started in background for {video_id}. Check /api/pipeline-status/{video_id}",
    }
```

If the file doesn't already import `JSONResponse`, add it to the FastAPI imports block at the top:

```python
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
```

- [ ] **Step 4: Release semaphore in `run_pipeline_and_forward`**

Find `run_pipeline_and_forward` (search: `async def run_pipeline_and_forward`). Wrap its existing body in a `try/finally` that releases the semaphore. The existing body uses `pipeline_status` heavily — keep it, just add the surrounding try/finally.

The change is: add `try:` at the very top of the function body (right after the docstring/comment) and `finally: pipeline_semaphore.release()` at the bottom (after all existing exception handling).

Concretely, the function should end with:

```python
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Error in background pipeline processing for {video_id}: {str(e)}")
        pipeline_status[video_id].update({"status": "failed", "step": "unknown", "error": str(e), "elapsed_seconds": round(elapsed)})
    finally:
        pipeline_semaphore.release()
        logger.info(f"Released pipeline slot for {video_id} (available now: {pipeline_semaphore._value})")
```

The outer `try:` already exists in the function (wrapping the pipeline launch). Add `finally:` as a peer to the existing `except Exception as e:` block. Do NOT add a redundant outer try — reuse the existing one.

- [ ] **Step 5: Run the existing service smoke check**

Without a real video, just verify the file imports/parses:

```bash
python -c "import server"
```

Expected: no errors. (`server` imports the FastAPI app and the semaphore at module load.)

- [ ] **Step 6: Commit**

```bash
git add server.py
git commit -m "feat(ai): asyncio.Semaphore cap for concurrent pipelines (MAX_CONCURRENT_PIPELINES)"
```

---

## Task 8: AI service — pytest for the 503 path

**Files:**
- Create: `/Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD/test_concurrency.py`

- [ ] **Step 1: Confirm pytest + httpx are available**

```bash
python -c "import pytest, httpx; print(pytest.__version__, httpx.__version__)"
```

If either is missing, install via:

```bash
pip install pytest httpx pytest-asyncio
```

- [ ] **Step 2: Write the test**

```python
# test_concurrency.py
import os
import asyncio
import pytest
from fastapi.testclient import TestClient

# Force the cap to 1 BEFORE importing server so the module-level semaphore picks it up.
os.environ["MAX_CONCURRENT_PIPELINES"] = "1"

import server  # noqa: E402


@pytest.fixture
def client():
    return TestClient(server.app)


@pytest.fixture(autouse=True)
def reset_semaphore():
    # Re-create the semaphore for each test so prior state can't leak.
    server.pipeline_semaphore = asyncio.Semaphore(1)
    server.pipeline_status.clear()
    yield


def test_returns_503_when_semaphore_at_cap(client):
    # Make the semaphore have zero slots — any acquire attempt fails immediately.
    server.pipeline_semaphore = asyncio.Semaphore(0)

    response = client.post(
        "/api/generate-ai-description",
        json={"youtube_id": "abc123", "data_type": "gemini"},
    )

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "busy"


def test_accepts_request_when_slot_free(client, monkeypatch):
    # Make the background pipeline a no-op so the test doesn't actually run anything.
    async def fake_run(*args, **kwargs):
        # Release synchronously so subsequent test runs don't block.
        pass

    monkeypatch.setattr(server, "run_pipeline_and_forward", fake_run)

    # Force the "no existing results" branch by ensuring glob.glob returns [].
    monkeypatch.setattr(server.glob, "glob", lambda *_: [])

    response = client.post(
        "/api/generate-ai-description",
        json={"youtube_id": "xyz789", "data_type": "gemini"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
```

- [ ] **Step 3: Run the test — expect PASS**

```bash
pytest test_concurrency.py -v
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add test_concurrency.py
git commit -m "test(ai): cover 503 path and slot acquisition"
```

---

## Task 9: Document the AI env var

**Files:**
- Modify: `/Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD/.env.example`
- Modify: `/Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-docs/env-templates/ai-generated-ad.env.template` (if it exists)

- [ ] **Step 1: Update `.env.example` in the AI repo**

Append:

```bash
# Concurrency cap for the AI pipeline (defense-in-depth — primary cap lives in the api).
# Default 2; should match or exceed AI_PIPELINE_CONCURRENCY on the api side.
MAX_CONCURRENT_PIPELINES=2
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "env: document MAX_CONCURRENT_PIPELINES"
```

- [ ] **Step 3: Update the docs repo template**

The file `YouDescribeX-docs/env-templates/ai-generated-ad.env.template` exists. Append the same line:

```bash
# Concurrency cap for the AI pipeline (defense-in-depth — primary cap lives in the api).
# Default 2; should match or exceed AI_PIPELINE_CONCURRENCY on the api side.
MAX_CONCURRENT_PIPELINES=2
```

Then commit in the docs repo:

```bash
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-docs
git add env-templates/ai-generated-ad.env.template
git commit -m "env: document MAX_CONCURRENT_PIPELINES for AI service"
cd -
```

---

## Task 10: Manual smoke test

This is integration validation against a real (or local) deployment. Run only after Tasks 1–9 are committed.

- [ ] **Step 1: Start local services**

In separate terminals:

```bash
# Terminal 1: api
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/YouDescribeX-api
AI_PIPELINE_CONCURRENCY=2 npm run dev
```

```bash
# Terminal 2: AI service
cd /Users/zhenzhenqin/Documents/NEU/2026Spring/AI-generated-AD
MAX_CONCURRENT_PIPELINES=2 python server.py
```

(Skip if smoke testing against a deployed env instead.)

- [ ] **Step 2: Verify dispatch under concurrency=2**

Trigger 3 AI description requests in quick succession (via the app UI or 3 `curl`s to `/api/users/request-ai-descriptions-with-gpu`). Confirm in the api logs:

```
Dispatching <id_A> to AI service (inFlight=0/2)
Dispatching <id_B> to AI service (inFlight=1/2)
```
and `id_C` waits.

Then when `id_A` finishes (Mongo status flips to `completed`), within 5s expect:

```
Dispatching <id_C> to AI service (inFlight=1/2)
```

- [ ] **Step 3: Verify email content**

Check the email inbox used for testing. For the 3 requests:

- Email 1 body should contain: `"Your video is next in line — processing will start shortly."`
- Email 2 body should contain: `"1 video(s) ahead of yours in the queue (1 being processed right now)"`
- Email 3 body should contain: `"2 video(s) ahead of yours in the queue (2 being processed right now)"`

- [ ] **Step 4: Verify 503 path**

Set `MAX_CONCURRENT_PIPELINES=1` on the AI service AND `AI_PIPELINE_CONCURRENCY=2` on the api. Trigger 2 requests. Expect the api logs to show one successful dispatch and one warning:

```
Dispatch failed for <id>: ... 503 ... Will retry next tick.
```

This validates the api gracefully handles the AI side rejecting via 503.

- [ ] **Step 5: Verify nothing broke at concurrency=1**

Set `AI_PIPELINE_CONCURRENCY=1`. Behavior should match pre-change: exactly one pipeline at a time, others wait. No regressions.

---

## Out of scope (do NOT do as part of this plan)

- Persistent queue. `videoProcessingQueue` stays in-memory; api restarts still lose queued items.
- Frontend changes (app repo).
- Time-based ETA in emails.
- Reworking the AI service's existing completion callback path.
- Touching the second `processNextInQueue` (non-Lana variant) unless it's actively called from modified paths.

---

## Verification before declaring done

- `git log --oneline -10` in both repos shows the expected commits.
- Both branches pushable: `git push --dry-run origin dev` (api) and `git push --dry-run origin zhenzhen-dev` (AI) report fast-forward-only.
- All Jest tests pass: `npm test` in api.
- All pytest tests pass: `pytest test_concurrency.py` in AI.
- Manual smoke (Task 10) shows: parallel dispatch up to N, queue overflow waits, emails report correct "videos ahead" counts.
