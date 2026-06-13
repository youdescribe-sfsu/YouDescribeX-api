# AI Pipeline Concurrency + "Videos Ahead" Email — Design

**Date:** 2026-06-12
**Repos touched:** `YouDescribeX-api` (`dev`), `AI-generated-AD` (`zhenzhen-dev`)

## Background

Today the api dispatches AI pipeline jobs strictly one at a time. The bottleneck is in `YouDescribeX-api/src/services/users.service.ts`:

- `videoProcessingQueue` (line 31) holds queued items in memory.
- `processNextInQueueLana` (line 685) refuses to dispatch a new pipeline whenever **any** `MongoAICaptionRequestModel` record has `status: 'processing'` — the cap is hard-coded at 1.
- The downstream AI service (`AI-generated-AD/server.py` on `zhenzhen-dev`) already runs each pipeline as a `BackgroundTask` with no cap of its own; it only rejects duplicate `youtube_id`s. So lifting the api's cap is what unblocks parallelism.

Now that the pipeline uses the Gemini API, Gemini RPM/TPM is no longer the constraint (Tier 1 covers ~150 RPM / 2M TPM, plenty for several concurrent pipelines). The real ceiling is the AI EC2 host: `m5.large` (2 vCPU, 8 GiB RAM, no GPU) running Whisper-on-CPU + OpenCV keyframe extraction. A safe starting parallelism is **2**, with room to raise the env var once the host is upgraded.

The initial "we received your request" email is sent in `performImmediateOperations` via `getNewAudioDescriptionEmailBody` (line 908). It currently gives no signal about wait time.

## Goals

1. Allow up to `N` AI pipeline jobs to run concurrently, where `N` is configurable per environment.
2. When `N` are already running, new requests wait in the existing queue; as soon as a slot frees, the next item dispatches automatically.
3. The initial "request received" email tells the user **how many videos are ahead of theirs** (queue position + currently processing), instead of just "we received it".
4. No regression in failure handling: stale-processing recovery (30 min timeout), failure notifications, and the duplicate-completed-video skip all continue to work.

## Non-goals (explicitly out of scope)

- Persistent queue. `videoProcessingQueue` stays in-memory; queued items are still lost on api restart. (Pre-existing bug — flagged separately.)
- Frontend changes. The app repo is not touched.
- Time-based ETA in emails. We're showing "videos ahead" only.
- Reworking how the AI service notifies completion back to the api — the existing `/api/audio-descriptions/newaidescription` callback path is unchanged.

## Design

### Repo 1 — `YouDescribeX-api` (`dev`)

#### 1.1 Configurable concurrency

- **New env var** `AI_PIPELINE_CONCURRENCY`, integer, default `2`.
- Read in `src/config/index.ts` (or wherever other env vars live) and export as `AI_PIPELINE_CONCURRENCY`.

#### 1.2 Concurrency-aware dispatch in `users.service.ts`

- Drop the `isProcessingQueue: boolean` flag (line 37). Mongo `status='processing'` count remains the source of truth for in-flight jobs.
- Rewrite `processNextInQueueLana`:
  - Compute `inFlight = await MongoAICaptionRequestModel.countDocuments({ status: 'processing' })`.
  - While `inFlight < AI_PIPELINE_CONCURRENCY` AND queue is non-empty: `shift()` the next item off the front (FIFO), mark Mongo `status: 'processing'` (upsert), call `sendToApiService`, increment a local `inFlight` counter so subsequent iterations of the same loop see it without re-querying Mongo.
  - After loop, if queue still has items (i.e. cap hit), `setTimeout(() => processNextInQueueLana(), 5000)` to retry — same poll cadence as today.
  - Keep stale-processing detection: any record `processing` for > 30 min is marked `failed` and the user notified via `gpuUtils.notifyAiDescriptionFailure`.

#### 1.3 Compute "videos ahead" inside `performImmediateOperations`

After `videoProcessingQueue.push(...)`:

```ts
const inQueueAhead       = Math.max(0, this.videoProcessingQueue.length - 1);
const currentlyProcessing = await MongoAICaptionRequestModel.countDocuments({ status: 'processing' });
const videosAhead         = inQueueAhead + currentlyProcessing;
```

Pass these into `getNewAudioDescriptionEmailBody`.

#### 1.4 Email body update

Change `getNewAudioDescriptionEmailBody(userName, videoTitle)` to `getNewAudioDescriptionEmailBody(userName, videoTitle, videosAhead, currentlyProcessing)`.

Insert a single sentence in the existing body:

- If `videosAhead === 0`:
  > *"Your video is next in line — processing will start shortly."*
- Else:
  > *"There are currently ${videosAhead} video(s) ahead of yours in the queue (${currentlyProcessing} being processed right now)."*

Place it after the "Here's what's happening" bullet list, before the "We'll notify you..." sentence. Everything else in the body stays.

### Repo 2 — `AI-generated-AD` (`zhenzhen-dev`)

#### 2.1 Defense-in-depth concurrency cap

- **New env var** `MAX_CONCURRENT_PIPELINES`, integer, default `2` (should match or exceed the api's cap; api is the primary scheduler).
- At module scope in `server.py`:
  ```python
  MAX_CONCURRENT_PIPELINES = int(os.getenv("MAX_CONCURRENT_PIPELINES", "2"))
  pipeline_semaphore = asyncio.Semaphore(MAX_CONCURRENT_PIPELINES)
  ```
- In `/api/generate-ai-description`, before scheduling `run_pipeline_and_forward`, do a non-blocking acquire attempt:
  ```python
  try:
      await asyncio.wait_for(pipeline_semaphore.acquire(), timeout=0)
  except asyncio.TimeoutError:
      return JSONResponse(status_code=503, content={"status": "busy", "message": "AI pipeline at capacity"})
  # if we got here, semaphore is acquired; release happens inside run_pipeline_and_forward via try/finally
  ```
- `run_pipeline_and_forward` must release the semaphore in a `finally` block so the slot is freed on success, failure, or exception.
- (Alternative pattern, slightly cleaner: keep the public endpoint thin, do the acquire/release inside `run_pipeline_and_forward` via `async with pipeline_semaphore:` — but that means the 503 path becomes "accepted then 503 later", which is worse UX. Stick with the explicit acquire-then-schedule pattern above.)
- This is **defense-in-depth only**: under normal operation the api will never dispatch above its own cap. The 503 path exists for edge cases (api restart, concurrency cap raised on one side but not the other).

## Data flow (happy path, concurrency = 2)

```
3 users request AI descriptions in quick succession for videos A, B, C.

T0: A request arrives
     api: inFlight = 0 < 2  →  mark A 'processing', call AI service
     api: enqueue user_A (videosAhead = 0)  →  email: "your video is next in line"
     AI:  semaphore.acquire(); pipeline for A starts
T1: B request arrives (seconds later)
     api: enqueue user_B; videosAhead = 0 in queue + 1 processing (A) = 1
     api: email: "1 video ahead of yours (1 being processed right now)"
     api: inFlight = 1 < 2 on next tick  →  mark B 'processing', dispatch to AI service
     AI:  pipeline for B starts
T2: C request arrives
     api: enqueue user_C; videosAhead = 0 in queue + 2 processing = 2
     api: email: "2 videos ahead of yours (2 being processed right now)"
     api: inFlight = 2 == cap  →  C stays in queue, retry tick scheduled
T3: A completes
     api: Mongo status flips to 'completed'; next 5s tick of processNextInQueueLana fires
     api: inFlight = 1 < 2  →  pop C, mark 'processing', call AI service
```

## Edge cases

- **All slots free, queue empty, request arrives:** dispatched immediately; email says "next in line"; `videosAhead = 0`.
- **All slots full, queue empty, request arrives:** added to queue; `videosAhead = N` (= concurrency); email says "N ahead, N being processed".
- **AI service returns 503 (semaphore at cap):** api logs warning, does NOT mark item failed, leaves item in queue, will retry on next 5s tick.
- **Pipeline fails mid-run:** existing path — Mongo flipped to `failed`, `notifyAiDescriptionFailure` email fires, slot freed for next item.
- **Stale processing (>30 min):** existing path — record flipped to `failed`, slot freed.
- **Duplicate request for same `youtube_id`:** AI service's existing duplicate guard kicks in.

## Risks

- **m5.large saturation.** Two concurrent pipelines may already push the host close to RAM limits (Whisper medium ≈ 1.5–3 GiB × 2 + OpenCV + Python overhead). Monitor first concurrent runs. Mitigation: easy rollback by setting `AI_PIPELINE_CONCURRENCY=1`.
- **Race between `countDocuments` and dispatch.** If two requests hit `processNextInQueueLana` simultaneously, both could read `inFlight < N` and dispatch. Mitigation: use a local in-method counter incremented before each Mongo write, so the second concurrent invocation sees the in-progress count. (Node's single-threaded event loop helps; only concurrent `await` points are interleaving risks.)
- **In-memory queue lost on restart.** Pre-existing, out of scope. After restart, Mongo records remain with `status: 'processing'` and will be cleared by the 30-min stale recovery; no new email goes out automatically.

## Repo sync prep (do before implementation)

- `YouDescribeX-api`: `dev` is 12 commits behind `origin/dev`. Pull before any commit.
- `AI-generated-AD`: `zhenzhen-dev` is in sync with `origin/zhenzhen-dev`. No pull needed.
- (Optional) `AI-generated-AD` local `dev` is 5 behind `origin/dev`, but that branch isn't touched by this work.

## Implementation outline

1. Pull `YouDescribeX-api/dev` → `origin/dev`.
2. Add `AI_PIPELINE_CONCURRENCY` to `src/config/index.ts` and `.env.example` (or whatever the repo's pattern is).
3. Refactor `videoProcessingQueue` + `processNextInQueueLana` to the concurrency-aware loop.
4. Update `performImmediateOperations` to compute `videosAhead` and pass into `getNewAudioDescriptionEmailBody`.
5. Update `getNewAudioDescriptionEmailBody` signature and body.
6. Switch to `AI-generated-AD/zhenzhen-dev`. Add `MAX_CONCURRENT_PIPELINES`, the semaphore, the 503 path, and the `async with` wrapper in `run_pipeline_and_forward`.
7. Update `.env.example` in both repos.
8. Manual smoke test: queue 3 requests with `AI_PIPELINE_CONCURRENCY=2`, verify two dispatch immediately, third waits, third dispatches on completion.
9. Verify emails for all three reflect correct "videos ahead" counts.
