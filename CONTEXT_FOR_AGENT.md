# Context for Handoff to Another Agent

This document summarizes goals, architecture, current state, and uncommitted changes across the YouDescribeX and AI-generated-AD repos so another agent can continue work.

---

## 1. Final Goals

- **Use MongoDB Atlas in development**  
  Run the API against the shared Atlas cluster (`youdescribe` database) without running MongoDB locally or copying the DB. No local MongoDB on port 27017 required.

- **End-to-end AI description pipeline**  
  From a YouTube video ID and user ID:
  1. API triggers the Youtube-Downloader to download the video and upload it (and metadata) to S3.
  2. Downloader calls the API back when done (`download-complete`).
  3. API triggers the AI-generated-AD service to run the pipeline (using S3 paths).
  4. AI service runs the pipeline (keyframes → transcribe → caption → optimize → `final_data.json`) and forwards results back to the API (which writes to MongoDB).

- **Re-run the pipeline for the same video**  
  Support clearing existing AI-generated audio descriptions for a video (e.g. after multiple test runs that append entries) so the E2E test can be run again without manual MongoDB edits. Provide both an API endpoint and an E2E script option (`--clear`).

- **Stable API server and clear failure reporting**  
  - API must stay running (no silent exit); report port-in-use or other bind errors clearly.
  - When the AI pipeline fails, surface the subprocess output (e.g. last 2k chars) in the pipeline-status response so the cause (S3, env, dependency, etc.) can be diagnosed without digging through server logs only.

---

## 2. Repositories and Roles

| Repo | Role |
|------|------|
| **YouDescribeX-api** | Node/Express API. Talks to MongoDB (Atlas or local), calls Youtube-Downloader and AI-generated-AD, exposes pipeline triggers and status. |
| **YouDescribeX-app** | Frontend (React). Not modified in this context. |
| **Youtube-Downloader** | External service: downloads YouTube video, uploads to S3, calls API `download-complete` with S3 paths. |
| **AI-generated-AD** | Python/FastAPI. Runs the video pipeline (`test_pipeline.py`), fetches from S3 when paths are provided, produces `final_data.json`, forwards to API. |

---

## 3. Proposed End-to-End Workflow

1. **Start services (separate terminals)**  
   - API: `cd YouDescribeX-api && npm run dev` (e.g. port 4001).  
   - Downloader: `cd Youtube-Downloader && python server.py` (e.g. port 8001).  
   - AI service: `cd AI-generated-AD && python -m uvicorn server:app --host 0.0.0.0 --port 8000`.  
   - MongoDB: use Atlas (no local MongoDB). Set `MONGO_DB_URI` in `.env.development.local` for the API.

2. **Trigger pipeline**  
   - Client calls API: `POST /api/users/start-ai-description-pipeline` with `{ "youtube_id": "...", "user_id": "..." }`.  
   - If an AI description already exists for that video, API returns `{ "status": "exists", "message": "AI description already exists for this video" }`.  
   - Otherwise API calls the Downloader; Downloader downloads video, uploads to S3, then calls API `POST /api/users/download-complete` with `youtube_id`, `user_id`, `ai_user_id`, `s3_paths`, `s3_bucket`.

3. **API → AI service**  
   - On `download-complete`, API calls the AI service (e.g. `POST /api/generate-ai-description` or equivalent) with the same ids and S3 paths.  
   - AI service runs `test_pipeline.py` with `--video_id` and optionally `--s3_video_path`, `--s3_metadata_path`. Pipeline fetches from S3 (or falls back to YouTube download), then runs keyframe/scene → transcribe → caption → optimize → prepare_final_data, then forwards results to the API.

4. **Status and completion**  
   - Client can poll `GET /api/users/pipeline-status/:youtube_id`.  
   - Response includes `status` (`processing` | `completed` | `failed` | `not_found`), `step`, `elapsed_seconds`, and on failure `error` and `log_tail` (last ~2k chars of pipeline output).  
   - On success, the API has written the new AI description to MongoDB and the video’s `audio_descriptions` array.

---

## 4. Test Plan

- **E2E script (YouDescribeX-api)**  
  - Path: `YouDescribeX-api/scripts/e2e-test-pipeline.sh`.  
  - Usage: `./scripts/e2e-test-pipeline.sh [youtube_id] [user_id]`  
  - Optional: `--clear` to clear existing AI description for the video first (calls `clear-ai-description-for-video` with `clear_all: true`), then triggers the pipeline again.  
  - Script:  
    1. Checks API, Downloader, and AI service (health or simple GET).  
    2. POSTs `start-ai-description-pipeline`; if response is `exists` and `--clear` is set, POSTs `clear-ai-description-for-video` with `clear_all: true`, then retries start.  
    3. Polls `pipeline-status/:youtube_id` every 30s (max 40 polls).  
    4. Exits 0 on `completed`, 1 on `failed` or timeout; on failure prints full status (including `log_tail` if present).

- **Clear endpoint (for re-runs)**  
  - `POST /api/users/clear-ai-description-for-video`  
  - Body: `{ "youtube_id": "<id>", "clear_all": true }` (optional `clear_all`; if true, removes all audio_descriptions for that video, not only the AI user’s).  
  - Used by the E2E script when `--clear` is passed.

- **Manual checks**  
  - Ensure API connects to Atlas when `MONGO_DB_URI` is set (no local MongoDB).  
  - If port is in use, API should log a clear error and exit with code 1.

---

## 5. Where We Are

- **Done**  
  - API uses `MONGO_DB_URI` when set (Atlas); no need to run MongoDB locally or copy the DB.  
  - Server bind failure handling: API logs “Port X is already in use” and exits with code 1.  
  - Clear-AI-description: endpoint and E2E `--clear` implemented; clear uses `clear_all: true` so all audio_descriptions for the video are removed (fixes “Still exists after clear” when multiple test runs had appended entries).  
  - Pipeline failure visibility: AI service captures subprocess stdout/stderr and returns last ~2k chars as `log_tail` in pipeline-status on failure; E2E script prints full status on failure.  
  - `test_pipeline.py` exits with 1 on pipeline failure and 2 on exception, so the AI server can report non-zero exit and store output.

- **Current failure**  
  - E2E run reaches “processing” then pipeline fails quickly (~2s) with **Exit code 2** and `step: "pipeline_execution"`.  
  - Likely causes (to be confirmed via `log_tail` or AI service console):  
    - S3: video not at the given path yet (timing) or wrong path.  
    - Missing or incorrect `s3_video_path` / `s3_metadata_path` in the download-complete callback.  
    - Python/dependency error at pipeline start (e.g. torch, config, or a script called by `test_pipeline.py`).  
  - Next step: run E2E again and inspect the failed pipeline-status response (`error` and `log_tail`) or the AI service terminal to identify the exact error and fix (S3 paths, callback payload, or env/deps).

---

## 6. Environment / Config (Relevant)

- **YouDescribeX-api**  
  - `.env.development.local`: set `MONGO_DB_URI` to the Atlas connection string (include database name, e.g. `youdescribe`). Do not commit credentials.  
  - `PORT`: e.g. 4001 (script assumes API on 4001).

- **AI-generated-AD**  
  - S3 bucket and credentials (e.g. `config.py` or env) for fetching video/metadata and uploading results.  
  - `S3_VIDEO_BUCKET` (or equivalent) must match what the Downloader and API use.

- **Youtube-Downloader**  
  - Must be running and call the API’s `download-complete` with correct `s3_paths` and `s3_bucket` so the API can pass them to the AI service.

---

## 7. Summary of Uncommitted Changes

### YouDescribeX-api

- **Modified**  
  - **src/config/index.ts**  
    - Added `MONGO_DB_URI` (read from `process.env.MONGO_DB_URI`, exported).  
    - Extended mongo config type and CONFIG with `uri`.  
  - **src/databases/index.ts**  
    - Use `MONGO_DB_URI` when set; otherwise build connection string from host/port/user/password.  
  - **src/app.ts**  
    - `listen()`: capture HTTP server from `app.listen()`, attach `server.on('error', ...)` to log bind errors (e.g. EADDRINUSE) and `process.exit(1)`.  
  - **src/services/users.service.ts**  
    - `clearAiDescriptionForVideo(youtube_id, clearAll?)`: when `clearAll` is true, remove all audio_descriptions for the video (not only AI user’s); delete related audio_clips and update video document.  
  - **src/controllers/users.controller.ts**  
    - `clearAiDescriptionForVideo`: body can include `clear_all: true`; pass through to service.  
  - **src/routes/users.route.ts**  
    - Added `POST /users/clear-ai-description-for-video`.  
  - **.gitignore**  
    - (Any local changes to ignore patterns; not detailed here.)  
  - **src/utils/env-initializer.ts**  
    - (Any env-loading changes; not detailed here.)

- **New / Untracked**  
  - **scripts/e2e-test-pipeline.sh**  
    - E2E script: health checks, start pipeline, optional `--clear`, poll pipeline-status, print full status on failure.  
  - **src/dtos/downloadCallback.dto.ts**, **src/dtos/videoQueryRequest.dto.ts**  
    - DTOs for download callback and video query (existing or added earlier).  
  - **.env.example**  
    - Example env vars (no secrets).

### AI-generated-AD

- **Modified**  
  - **server.py**  
    - Run pipeline subprocess with `stdout=PIPE`, `stderr=STDOUT`; after `process.communicate()`, on non-zero exit store last 2000 chars of output in `pipeline_status[video_id]["log_tail"]` and set `error` to `"Exit code {returncode}"`.  
  - **test_pipeline.py**  
    - In `__main__`: on `run_pipeline(...)` False, print failure to stderr and `sys.exit(1)`; on exception, log and `sys.exit(2)`.  
  - **.gitignore**, **environment.yml**, **keyframe_scene_detector.py**, **youtube_downloader.py**, **video_query_keyframe.py**  
    - (Other local edits; not enumerated in this handoff.)

- **New / Untracked**  
  - **config.py**, **s3_fetcher.py**, **.env.example**  
    - Config and S3 fetch/upload helpers.

- **Deleted (tracked)**  
  - **videos/GxWxmAG8AUQ/**  
    - Some test video files removed (GxWxmAG8AUQ.jpg, .json, .mp4).

---

## 8. Quick Reference: Key Endpoints and Scripts

| Item | Details |
|------|--------|
| Start pipeline | `POST /api/users/start-ai-description-pipeline` body: `{ "youtube_id", "user_id" }` |
| Clear AI description | `POST /api/users/clear-ai-description-for-video` body: `{ "youtube_id", "clear_all": true }` |
| Pipeline status | `GET /api/users/pipeline-status/:youtube_id` |
| Download callback | `POST /api/users/download-complete` (called by Downloader with S3 paths) |
| E2E script | `YouDescribeX-api/scripts/e2e-test-pipeline.sh [youtube_id] [user_id]` with optional `--clear` |

---

*End of context document.*
