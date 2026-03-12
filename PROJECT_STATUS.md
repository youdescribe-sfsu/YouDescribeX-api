# YouDescribeX — Project Status & Migration Plan

> **Last updated:** 2025-02-19 (by Cursor agent, validated against actual code)
> **Working branch (all repos):** `zhenzhen-dev`

---

## 1. The Goal

**Problem:** AWS EC2 IPs are blocked by YouTube, preventing video downloads from within the cloud.

**Solution:** Split the video processing pipeline so that the **YouTube download** runs on a **local machine** (residential IP), while the **AI inference** pipeline continues to run on **AWS EC2**. All services coordinate through the Node.js API acting as the "traffic controller", with S3 as the shared storage layer.

### Target Architecture

```
┌─────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐
│ YouDescribeX │      │   YouDescribeX-api        │      │  AI-generated-AD        │
│   -app       │─────▶│   (Node.js / Express)     │─────▶│  (Python / FastAPI)     │
│ (React)      │      │   HOST: AWS EC2           │      │  HOST: AWS EC2          │
│ HOST: AWS    │      │                            │      │                          │
└─────────────┘      │  MongoDB Atlas (shared)    │      │  Reads video from S3    │
                     │  Acts as Traffic Controller │      │  Runs AI pipeline        │
                     └──────────┬───────────────┘      │  Forwards results → API  │
                                │                        └─────────────────────────┘
                                │  Trigger download
                                ▼
                     ┌──────────────────────────┐
                     │  Youtube-Downloader       │
                     │  (Python / FastAPI)       │
                     │  HOST: LOCAL LAPTOP       │
                     │  (exposed via ngrok)      │
                     │                            │
                     │  Downloads from YouTube   │
                     │  Uploads to AWS S3        │
                     │  Calls API callback       │
                     └──────────────────────────┘
```

### End-to-End Flow (Sequence)

```
User (App)                API                    Downloader (Local)       S3              AI Service (EC2)
    │                       │                          │                    │                    │
    │  POST start-pipeline  │                          │                    │                    │
    │──────────────────────▶│                          │                    │                    │
    │                       │  POST /api/download      │                    │                    │
    │                       │─────────────────────────▶│                    │                    │
    │  { status: processing}│                          │                    │                    │
    │◀──────────────────────│                          │                    │                    │
    │                       │                          │  yt-dlp download   │                    │
    │                       │                          │  ───────────────▶  │                    │
    │                       │                          │  Upload .mp4+.json │                    │
    │                       │                          │  ───────────────▶  │                    │
    │                       │  POST download-complete  │                    │                    │
    │                       │◀─────────────────────────│                    │                    │
    │                       │                          │                    │                    │
    │                       │  POST generate-ai-description                │                    │
    │                       │──────────────────────────────────────────────────────────────────▶│
    │                       │                          │                    │                    │
    │  GET pipeline-status  │                          │                    │  Fetch from S3     │
    │──────────────────────▶│  GET pipeline-status     │                    │◀───────────────────│
    │                       │──────────────────────────────────────────────────────────────────▶│
    │  { status: processing}│                          │                    │  Run inference     │
    │◀──────────────────────│                          │                    │  (keyframes,       │
    │                       │                          │                    │   captions, etc.)  │
    │  ... (poll every 30s) │                          │                    │                    │
    │                       │                          │                    │                    │
    │                       │  POST newaidescription (final_data.json)     │                    │
    │                       │◀─────────────────────────────────────────────────────────────────│
    │                       │  Write to MongoDB        │                    │                    │
    │                       │  (audio_descriptions)    │                    │                    │
    │  GET pipeline-status  │                          │                    │                    │
    │──────────────────────▶│                          │                    │                    │
    │  { status: completed }│                          │                    │                    │
    │◀──────────────────────│                          │                    │                    │
```

### Endpoint Contract Table

| Endpoint | Service | Method | Request Body | Response |
|----------|---------|--------|-------------|----------|
| `/api/users/start-ai-description-pipeline` | API | POST | `{ youtube_id, user_id }` | `{ status: "processing" \| "exists" }` |
| `/api/users/download-complete` | API (callback) | POST | `{ youtube_id, user_id, ai_user_id, s3_paths: { video, metadata }, s3_bucket, status }` | `{ status: "ai_processing" }` |
| `/api/users/pipeline-status/:youtube_id` | API (proxy) | GET | — | `{ status, step, elapsed_seconds, error?, log_tail? }` |
| `/api/users/clear-ai-description-for-video` | API | POST | `{ youtube_id, clear_all?: boolean }` | `{ status: "cleared", removed: N }` |
| `/api/users/query-video-frame` | API | POST | `{ youtubeVideoId, question, timeStamp }` | `string` (AI answer) |
| `/api/download` | Downloader | POST | `{ youtube_id, user_id?, ai_user_id?, callback_url? }` | `{ youtube_id, status }` |
| `/api/download/status/:youtube_id` | Downloader | GET | — | `{ youtube_id, status, s3_paths?, error? }` |
| `/api/generate-ai-description` | AI Service | POST | `{ youtube_id, user_id?, ai_user_id?, s3_video_path?, s3_metadata_path? }` | `{ status: "processing" }` |
| `/api/pipeline-status/:video_id` | AI Service | GET | — | `{ status, step, elapsed_seconds, error?, log_tail? }` |
| `/api/query-video-frame` | AI Service | POST | `{ video_id, question, current_time }` | `{ status, response }` |
| `/api/newaidescription` | AI Service → API | POST | `final_data.json` contents | — |
| `/health` | Downloader, AI | GET | — | `{ status: "healthy" }` |

---

## 2. Repository Roles & Branches

| Repo | Path | Role | Working Branch | Base (Prod) | Feature Reference |
|------|------|------|---------------|-------------|-------------------|
| **YouDescribeX-api** | `~/Documents/NEU/2026Spring/YouDescribeX-api` | Node.js/Express backend, MongoDB, traffic controller | `zhenzhen-dev` | `dev` | `feature/info-bot` |
| **YouDescribeX-app** | `~/Documents/NEU/2026Spring/YouDescribeX-app` | React frontend | `zhenzhen-dev` | `dev` | `xuan/info-bot` |
| **AI-generated-AD** | `~/Documents/NEU/2026Spring/AI-generated-AD` | Python/FastAPI AI pipeline (keyframes, captions, optimization) | `zhenzhen-dev` | `main` | N/A |
| **Youtube-Downloader** | `~/Documents/NEU/2026Spring/Youtube-Downloader` | Python/FastAPI video downloader + S3 uploader (local laptop) | `zhenzhen-dev` | N/A (new) | N/A |

---

## 3. Database Architecture

**Only the API touches MongoDB.** Neither Python service has a MongoDB driver.

- **API:** Uses `mongoose@^6.9.1` for MongoDB, `sequelize@^6.16.2` for PostgreSQL. Current config uses MongoDB Atlas (`MONGO_DB_URI` env var takes precedence over individual host/port fields).
- **AI-generated-AD:** No database driver. Communicates with API via HTTP (`requests` library). Forwards `final_data.json` to `POST /api/audio-descriptions/newaidescription`.
- **Youtube-Downloader:** No database driver. Calls API callback at `POST /api/users/download-complete` with S3 paths.

**Collections involved in the AI pipeline flow:**
- `videos` — video records keyed by `youtube_id`; has `audio_descriptions` array of ObjectIds
- `audio_descriptions` — audio description documents tied to a video + user
- `audio_clips` — individual audio clips within an audio description
- `users` — user records; AI user has `user_type: "AI"` (identified by `AI_USER_ID` env var)
- `ai_caption_requests` — tracks AI description request status per video/user

**The Youtube-Downloader does NOT need MongoDB access.** It only needs to know the API callback URL.

---

## 4. Code Comparison: `dev` vs `feature/info-bot`

### 4a. API: `dev` vs `feature/info-bot`

**22 files changed, 630 insertions(+), 978 deletions(-)**

#### Files that introduce "Local AI connectivity" (what we want):

| File | What info-bot adds | Already in zhenzhen-dev? |
|------|--------------------|--------------------------|
| `src/dtos/infoBotRequest.dto.ts` (NEW) | DTO: `{ question, youtubeVideoId, timeStamp }` | YES — renamed as `videoQueryRequest.dto.ts` |
| `src/controllers/users.controller.ts` | `infoBotGenerateAnswer()`, `requestAiDescriptionsWithLana()` | YES — renamed as `queryVideoFrame()`, `startAiDescriptionPipeline()` |
| `src/routes/users.route.ts` | `POST /info-bot`, `POST /request-ai-descriptions-with-lana` | YES — renamed as `POST /query-video-frame`, `POST /start-ai-description-pipeline` |
| `src/services/users.service.ts` | `infoBotGenerateAnswer()` calls `http://0.0.0.0:8000/api/info-bot`; `requestAiDescriptionsWithLana()` calls `http://0.0.0.0:8000/api/generate_ai_caption` | YES — improved: uses configurable `AI_SERVICE_URL`, updated endpoint names, added download-complete/pipeline-status flows |

#### Files with other changes in info-bot (NOT needed for our goal):

| File | What changed | Risk if merged |
|------|-------------|----------------|
| `src/services/audioClips.service.ts` | Major refactoring (-402 lines) | HIGH — unrelated to AI pipeline |
| `src/services/wishlist.service.ts` | Simplified/removed logic | HIGH — unrelated |
| `src/utils/audioClips.util.ts` | Simplified | MEDIUM — unrelated |
| `src/utils/coquiTTS.util.ts` | Deleted entirely | HIGH — breaks TTS if used in prod |
| `src/utils/openAPI.util.ts` | Major cuts | MEDIUM — unrelated |
| `src/models/mongodb/AudioClips.mongo.ts` | Removed 49 lines | HIGH — schema change |
| `src/config/index.ts` | Removed 19 lines (some config vars) | HIGH — could break other features |

#### Important logic difference — AI audio description cloning:

The `dev` branch has a comment `// CHANGED: No longer search for AI descriptions or copy clips` in both `generateAudioDescGpu()` and `createNewUserAudioDescription()`. The `feature/info-bot` branch **restores** the AI clip cloning behavior: when a user requests an audio description and an AI-generated one already exists, it clones all AI audio clips for the user.

**Current zhenzhen-dev** inherits the `dev` behavior (no cloning). **DECISION: Restore this logic.** The AI clip cloning is needed so that when a user clicks "Describe" on a video that already has an AI description, they get a copy of the AI-generated clips as a starting point.

### 4b. APP: `dev` vs `xuan/info-bot`

**14 files changed, 805 insertions(+), 1073 deletions(-)**

| File | What changed |
|------|-------------|
| `src/pages/Video/Video.tsx` | MAJOR refactor (1547 lines changed) — added info-bot UI, speech recognition interfaces, removed some state management |
| `src/shared/components/Navbar/Navbar.tsx` | UI changes (88 lines) |
| `src/shared/components/Navbar/Navbar.css` | Style changes (106 lines) |
| `src/shared/components/Navbar/SearchBar/searchBar.scss` | Style changes (65 lines) |
| Various other CSS/component files | Minor changes |

**DECISION: Implement ALL features from `xuan/info-bot`.** Port all functionality (info-bot chat UI, speech recognition, navbar changes, etc.) into `zhenzhen-dev` on the APP, adapting endpoint names to match the new API (`/query-video-frame` instead of `/info-bot`). Code may be refactored for best practices, but all functionality must be preserved. When in doubt about whether something is needed, keep it.

---

## 5. Current Status (Validated Against Code)

### What's DONE and working:

| Item | Status | Validated |
|------|--------|-----------|
| **Youtube-Downloader** — standalone service, downloads video, uploads to S3, calls API callback | DONE | YES — clean code, no uncommitted changes, tested successfully |
| **API — MongoDB Atlas support** via `MONGO_DB_URI` env var | DONE | YES — `src/databases/index.ts` uses `MONGO_DB_URI` when set |
| **API — Pipeline endpoints** (start, download-complete, pipeline-status, clear, query-video-frame) | DONE | YES — routes, controllers, and service methods all exist |
| **API — Server bind error handling** | DONE | YES — `src/app.ts` has EADDRINUSE handler |
| **API — E2E test script** | DONE | YES — `scripts/e2e-test-pipeline.sh` exists with health checks, polling |
| **API — Config for AI_SERVICE_URL, DOWNLOADER_SERVICE_URL, S3_VIDEO_BUCKET** | DONE | YES — `src/config/index.ts` exports these |
| **AI Service — S3 integration** via `s3_fetcher.py`, `config.py` | DONE | YES — S3Fetcher class with download/upload/cleanup methods |
| **AI Service — Pipeline status tracking with log_tail** | DONE | YES — `server.py` captures subprocess output, stores last 2k chars |
| **AI Service — generate-ai-description endpoint with S3 path support** | DONE | YES — `UnifiedVideoRequest` model accepts `s3_video_path`, `s3_metadata_path` |

### What's DONE (recently completed):

| Item | Status | Date |
|------|--------|------|
| **E2E pipeline fully working** — API -> Downloader -> S3 -> AI -> API -> MongoDB -> TTS -> MP3 | DONE | 2026-02-19 |
| **TTS credentials fixed** — `GOOGLE_APPLICATION_CREDENTIALS` set, processAllClipsInDB succeeds | DONE | 2026-02-19 |
| **APP — info-bot features ported** from `xuan/info-bot` to `zhenzhen-dev` | DONE | 2026-02-19 |
| **APP — endpoint names updated** — `/info-bot` -> `/query-video-frame`, `/request-ai-descriptions-with-gpu` -> `/start-ai-description-pipeline` | DONE | 2026-02-19 |
| **APP — Navbar, styles, DescriberCard, EditClip, Video.tsx** all ported from info-bot | DONE | 2026-02-19 |
| **E2E test script** — enhanced with post-pipeline verification (audio description + clip + MP3 checks) | DONE | 2026-02-19 |

### What's NOT started:

| Item | Notes |
|------|-------|
| **AI audio clip cloning** — restoring the behavior where existing AI descriptions get cloned for new users | Currently disabled on `dev`/`zhenzhen-dev` |
| **ngrok setup** for exposing the local Downloader to the internet | Needed for non-localhost deployment |
| **AWS deployment** of API and AI service | Development is still local-first |

---

## 6. Uncommitted Changes Summary

### YouDescribeX-api (8 files modified, 2 new files, 309 insertions)

| File | Change |
|------|--------|
| `.gitignore` | +4 lines (ignore patterns) |
| `src/app.ts` | +9/-1 (bind error handling) |
| `src/config/index.ts` | +22 (MONGO_DB_URI, pipeline service config) |
| `src/controllers/users.controller.ts` | +77 (pipeline + query endpoints) |
| `src/databases/index.ts` | +13/-1 (MONGO_DB_URI support) |
| `src/routes/users.route.ts` | +7 (5 new routes) |
| `src/services/users.service.ts` | +185/-1 (pipeline orchestration methods) |
| `src/utils/env-initializer.ts` | +2/-2 (minor) |
| `scripts/e2e-test-pipeline.sh` (NEW) | E2E test script |
| `src/dtos/downloadCallback.dto.ts` (NEW) | Download callback DTO |
| `src/dtos/videoQueryRequest.dto.ts` (NEW) | Video query DTO |
| `.env.example` (NEW) | Environment variable template |

### AI-generated-AD (7 files modified, 3 new files, 288 insertions)

| File | Change |
|------|--------|
| `.gitignore` | minor |
| `environment.yml` | +1 dependency |
| `keyframe_scene_detector.py` | +12/-12 changes |
| `server.py` | +151/-35 (pipeline status, S3 support, retry logic) |
| `test_pipeline.py` | +119/-7 (S3 fetch integration, exit codes) |
| `video_query_keyframe.py` | +55/-10 (S3 keyframe support) |
| `youtube_downloader.py` | +15/-15 changes |
| `config.py` (NEW) | Central S3/API config |
| `s3_fetcher.py` (NEW) | S3 download/upload/cleanup module |
| `.env.example` (NEW) | Environment variable template |

### Youtube-Downloader — CLEAN (no uncommitted changes, 3 commits)

### YouDescribeX-app (21 files changed, 734 insertions, 1073 deletions)

| File | Change |
|------|--------|
| `src/pages/Video/Video.tsx` | Major refactor — info-bot chat UI (Alt+D for description, Alt+Q for Q&A), speech recognition, endpoint updates |
| `src/shared/components/Navbar/Navbar.tsx` | New logo layout, responsive navbar redesign |
| `src/shared/components/Navbar/Navbar.css` | Simplified navbar styles |
| `src/shared/components/Navbar/SearchBar/searchBar.scss` | Search bar style updates |
| `src/features/Video/DescriberCard/DescriberCard.tsx` | Added `type` prop, AI user detection by type instead of name |
| `src/features/Describe/EditClip/EditClip.tsx` | Recording duration bugfix |
| `src/features/Describe/NewAudioClip/NewAudioClip.tsx` | Recording fix |
| `src/pages/Video/Video_v2.tsx` | Pass `user_type` to DescriberCard |
| `src/pages/VideoEmbed/VideoEmbed.tsx` | Simplified AI user name display |
| `src/types.d.ts` (NEW) | SpeechRecognition browser API types |
| `public/ding-new.mp3` (NEW) | Sound effect for speech recognition |
| `public/ding.mp3` (NEW) | Sound effect |
| `src/app.scss`, `src/assets/css/index.css` | Color theme updates |
| `public/assets/css/styles.css`, `public/manifest.json` | Layout/theme adjustments |
| 5 images removed | Old logo images replaced by existing indigo/grey logos |

---

## 7. Consolidated Migration Plan

### Phase 1: Fix the E2E Pipeline — DONE
1. ~~Debug why `test_pipeline.py` exits with code 2 on the AI service~~
2. ~~Verify AI service has all required env vars (AWS creds, LLM API keys)~~
3. ~~Verify S3 path format consistency between Downloader callback and AI service~~
4. ~~Get one successful end-to-end run: API → Downloader → S3 → AI → API → MongoDB~~
5. ~~Fix TTS credentials (GOOGLE_APPLICATION_CREDENTIALS) for processAllClipsInDB~~

### Phase 2: Restore AI Audio Clip Cloning
1. Restore the AI audio description cloning logic in `users.service.ts` (both `generateAudioDescGpu` and `createNewUserAudioDescription`)
2. When an AI description exists for a video, clone its audio clips for the requesting user
3. This was removed in `dev` but exists in `feature/info-bot` — port the logic back

### Phase 3: Commit & Stabilize
1. Commit all uncommitted changes on `zhenzhen-dev` (API + AI + APP repos)
2. Ensure `.env` files with real credentials are NOT committed (use GitLab CI/CD vars for prod)
3. Test the full flow multiple times with different videos
4. Verify `--clear` flag works for re-running the pipeline

### Phase 4: Frontend Integration — DONE
1. ~~Port ALL features from `xuan/info-bot` into `zhenzhen-dev` (APP)~~
2. ~~Adapt endpoint names to match the new API (`/query-video-frame` instead of `/info-bot`, `/start-ai-description-pipeline` instead of `/request-ai-descriptions-with-gpu`)~~
3. ~~Include: info-bot chat UI, speech recognition, navbar changes, Video.tsx refactoring~~
4. ~~Clean up hardcoded URLs and dummy data~~

### Phase 5: Deployment Preparation
1. Set up ngrok (or similar) for exposing the local Downloader
2. Update `DOWNLOADER_SERVICE_URL` in API config to use the ngrok URL
3. Deploy API and AI service to AWS EC2
4. Verify the full cross-network flow

### Phase 6: Production Polish (Later)
1. Add proper error recovery (retry failed downloads, resume interrupted pipelines)
2. Monitoring and alerting
3. Consider MongoDB collection for video pipeline metadata if needed

---

## 8. Key Configuration

### API (.env.development.local)
```
AI_SERVICE_URL=http://localhost:8000        # AI-generated-AD FastAPI
DOWNLOADER_SERVICE_URL=http://localhost:8001 # Youtube-Downloader FastAPI
S3_VIDEO_BUCKET=youdescribe-downloaded-youtube-videos
MONGO_DB_URI=mongodb+srv://...@cluster.mongodb.net/youdescribe
AI_USER_ID=68798f57c48a173631902319
PORT=4001
```

### Downloader (.env)
```
S3_BUCKET_NAME=youdescribe-downloaded-youtube-videos
API_CALLBACK_URL=http://localhost:4001
PORT=8001
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-west-1
```

### AI Service (.env)
```
S3_VIDEO_BUCKET=youdescribe-downloaded-youtube-videos
API_BASE_URL=http://localhost:4001
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
# LLM keys: OPENAI_API_KEY, GEMINI_API_KEY, QWEN_API_KEY
```

---

## 9. Decisions Log

| # | Question | Decision | Date |
|---|----------|----------|------|
| 1 | .env security | Local dev only; credentials not committed; GitLab CI/CD vars for prod | 2025-02-19 |
| 2 | AI audio clip cloning | RESTORE — needed for users to see AI descriptions | 2025-02-19 |
| 3 | APP info-bot features | Implement ALL from `xuan/info-bot`, refactor but keep all functionality | 2025-02-19 |
| 4 | Video metadata in MongoDB | Pass-through approach for MVP; revisit later | 2025-02-19 |
| 5 | Endpoint naming convention | Hyphen-style (`/query-video-frame`), consistent with existing API | 2025-02-19 |
| 6 | Backward compatibility | Not needed for now | 2025-02-19 |

---

## 10. How to Run & Debug Each Service

### 10a. YouDescribeX-api (Node.js)

```bash
cd ~/Documents/NEU/2026Spring/YouDescribeX-api
npm run dev
# Runs on http://localhost:4001
```

**Logs:** Terminal output (stdout). Also writes to `logs/` directory.
**Health check:** `curl http://localhost:4001/api/users/get-all-users` (no dedicated `/health` endpoint on API).

### 10b. Youtube-Downloader (Python/FastAPI)

```bash
cd ~/Documents/NEU/2026Spring/Youtube-Downloader
# If using a virtual environment:
# python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python server.py
# Runs on http://localhost:8001
```

**Logs:** Terminal output + `downloader.log` file in the project directory.
**Health check:** `curl http://localhost:8001/health`

### 10c. AI-generated-AD (Python/FastAPI) — THE ONE YOU FORGOT

This service has heavier dependencies (PyTorch, transformers, whisper, etc.) managed via **conda**.

**First-time setup:**
```bash
cd ~/Documents/NEU/2026Spring/AI-generated-AD

# Create conda environment from environment.yml
conda env create -f environment.yml

# Activate the environment
conda activate video_describe
```

**Running the service:**
```bash
cd ~/Documents/NEU/2026Spring/AI-generated-AD
conda activate video_describe
python -m uvicorn server:app --host 0.0.0.0 --port 8000
# OR simply:
python server.py
# Runs on http://localhost:8000
```

**Checking logs / debugging failures:**
- **Terminal output:** The server prints all logs to the terminal (stdout/stderr). This is the primary place to look when something goes wrong.
- **Log file:** `ai_service.log` in the project directory — same content as terminal output.
- **Pipeline-specific failure info:** When the pipeline fails, `server.py` stores the last 2000 characters of pipeline output. You can check this via:
  ```bash
  curl http://localhost:8000/api/pipeline-status/<youtube_id>
  ```
  The response will include `"error"`, `"log_tail"` (last 2k chars of output), and `"step"` (which step failed).

**Environment variables required** (create `.env` in the AI-generated-AD directory):
```
# LLM API Keys (at least one needed for caption generation)
OPENAI_API_KEY=your-key
GEMINI_API_KEY=your-key
API_KEY=your-qwen-api-key          # for Qwen model

# AWS S3 (needed to fetch videos uploaded by the Downloader)
S3_VIDEO_BUCKET=youdescribe-downloaded-youtube-videos
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# API callback URL
API_BASE_URL=http://localhost:4001

# Google credentials (for speech-to-text)
GOOGLE_APPLICATION_CREDENTIALS=google_credentials.json
```

**Health check:** `curl http://localhost:8000/health`

### 10d. How to Debug the Current E2E Pipeline Failure

The pipeline is failing with exit code 2 at the AI service. Here's how to investigate:

**Step 1: Make sure all 3 services are running**
```bash
# Terminal 1: API
cd ~/Documents/NEU/2026Spring/YouDescribeX-api && npm run dev

# Terminal 2: Downloader
cd ~/Documents/NEU/2026Spring/Youtube-Downloader && python server.py

# Terminal 3: AI Service (watch this terminal for errors!)
cd ~/Documents/NEU/2026Spring/AI-generated-AD && conda activate video_describe && python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

**Step 2: Trigger the pipeline and watch Terminal 3**
```bash
# In a 4th terminal:
curl -X POST http://localhost:4001/api/users/start-ai-description-pipeline \
  -H "Content-Type: application/json" \
  -d '{"youtube_id":"BB49x_uMlGA","user_id":"68798f57c48a173631902319"}'
```

**Step 3: Check the AI service terminal** — it will show the exact Python traceback when `test_pipeline.py` crashes.

**Step 4: If the terminal scrolled past the error, check the pipeline status API:**
```bash
curl http://localhost:8000/api/pipeline-status/BB49x_uMlGA
```
Look at the `log_tail` field — it contains the last 2000 characters of the pipeline subprocess output, which should include the Python traceback.

**Step 5: Also check the log file:**
```bash
cat ~/Documents/NEU/2026Spring/AI-generated-AD/ai_service.log
```

**Common failure causes:**
1. **conda environment not activated** — `ModuleNotFoundError` for torch, transformers, etc.
2. **Missing `.env` file** — AWS credentials not set, S3 fetch fails
3. **Missing Google credentials file** — `google_credentials.json` not found (needed for speech-to-text)
4. **S3 path mismatch** — the video wasn't uploaded by the Downloader yet, or the path format differs
5. **Missing LLM API key** — no OPENAI_API_KEY or GEMINI_API_KEY set for caption generation

---

*End of project status document.*
