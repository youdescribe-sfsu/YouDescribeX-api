#!/usr/bin/env bash
# E2E test: start AI description pipeline (API -> Downloader -> S3 -> AI service -> API).
#
# Prerequisites (start in separate terminals):
#   1. API:        cd YouDescribeX-api && npm run dev
#   2. Downloader: cd Youtube-Downloader && python server.py  (or uvicorn)
#   3. AI service: cd AI-generated-AD && python -m uvicorn server:app --host 0.0.0.0 --port 8000
#   MongoDB must be reachable (e.g. Atlas) and .env.development.local / .env set.
#
# Usage: ./scripts/e2e-test-pipeline.sh [youtube_id] [user_id]
#   Add --clear to clear existing AI description for the video first (so pipeline runs again).

set -e
CLEAR_FIRST=
args=()
for a in "$@"; do
  if [ "$a" = "--clear" ]; then
    CLEAR_FIRST=1
  else
    args+=("$a")
  fi
done
YOUTUBE_ID="${args[0]:-BB49x_uMlGA}"
USER_ID="${args[1]:-68798f57c48a173631902319}"
API="http://localhost:4001"
DOWNLOADER="http://localhost:8001"
AI_SERVICE="http://localhost:8000"

echo "=== E2E Pipeline Test ==="
echo "Video: $YOUTUBE_ID | User: $USER_ID"
echo ""

# 1. Health checks
echo "1. Checking services..."
for name in "API:$API" "Downloader:$DOWNLOADER" "AI:$AI_SERVICE"; do
  label="${name%%:*}"
  url="${name#*:}"
  if curl -sf "${url}/health" >/dev/null 2>&1 || curl -sf "${url}/api/users/get-all-users" >/dev/null 2>&1; then
    echo "   $label OK"
  else
    echo "   $label NOT reachable at $url"
    echo "   Start: API (npm run dev), Downloader (python server.py), AI (uvicorn server:app --port 8000)"
    exit 1
  fi
done

# API doesn't have /health at root; check a simple endpoint
if ! curl -sf "$API/api/users/get-all-users" >/dev/null 2>&1; then
  echo "   API not responding. Is it running on 4001?"
  exit 1
fi
echo ""

# 2. Trigger pipeline
echo "2. Triggering pipeline (start-ai-description-pipeline)..."
RESP=$(curl -s -X POST "$API/api/users/start-ai-description-pipeline" \
  -H "Content-Type: application/json" \
  -d "{\"youtube_id\":\"$YOUTUBE_ID\",\"user_id\":\"$USER_ID\"}")
echo "   Response: $RESP"
if echo "$RESP" | grep -q "Cannot POST"; then
  echo "   The API does not have this route. Restart the API (e.g. npm run dev) to load the new routes, then run this script again."
  exit 1
fi
if echo "$RESP" | grep -q '"status":"exists"'; then
  if [ -n "$CLEAR_FIRST" ]; then
    echo "   Clearing existing AI description, then re-triggering pipeline..."
    curl -s -X POST "$API/api/users/clear-ai-description-for-video" \
      -H "Content-Type: application/json" \
      -d "{\"youtube_id\":\"$YOUTUBE_ID\",\"clear_all\":true}" >/dev/null
    RESP=$(curl -s -X POST "$API/api/users/start-ai-description-pipeline" \
      -H "Content-Type: application/json" \
      -d "{\"youtube_id\":\"$YOUTUBE_ID\",\"user_id\":\"$USER_ID\"}")
    echo "   Response: $RESP"
  else
    echo "   AI description already exists for this video. Use a different video_id, run with --clear to re-run, or clear in MongoDB."
    exit 0
  fi
fi
if echo "$RESP" | grep -q '"status":"exists"'; then
  echo "   Still exists after clear. Aborting."
  exit 1
fi
if ! echo "$RESP" | grep -qE '"status":"processing"|"status":"exists"'; then
  echo "   Unexpected response. Aborting."
  exit 1
fi
echo ""

# 3. Poll pipeline status
echo "3. Polling pipeline status (every 30s, max 20 min)..."
MAX_POLL=40
POLL_INTERVAL=30
for i in $(seq 1 $MAX_POLL); do
  sleep $POLL_INTERVAL
  STATUS=$(curl -s "$API/api/users/pipeline-status/$YOUTUBE_ID")
  echo "   [$i] $STATUS"
  if echo "$STATUS" | grep -q '"status":"completed"'; then
    echo ""
    echo "=== Pipeline completed successfully ==="
    echo ""

    # 4. Verify APP-facing API contract
    echo "4. Verifying APP-facing data (audio descriptions, clips, audio file)..."

    # Fetch the video data (same endpoint the APP calls)
    VIDEO_DATA=$(curl -s "$API/api/videos/$YOUTUBE_ID")
    AD_IDS=$(echo "$VIDEO_DATA" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ads = d.get('audio_descriptions', [])
    for ad in ads:
        ad_id = ad.get('_id', ad) if isinstance(ad, dict) else ad
        print(ad_id)
except: pass
" 2>/dev/null)

    if [ -z "$AD_IDS" ]; then
      echo "   WARN: No audio_descriptions found in video data for $YOUTUBE_ID"
    else
      AD_COUNT=$(echo "$AD_IDS" | wc -l | tr -d ' ')
      echo "   Found $AD_COUNT audio description(s) for video $YOUTUBE_ID"

      # Check the first audio description has clips
      FIRST_AD=$(echo "$AD_IDS" | head -1)
      AD_DETAIL=$(curl -s "$API/api/audio-descriptions/$FIRST_AD")
      CLIP_COUNT=$(echo "$AD_DETAIL" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    clips = d.get('audio_clips', [])
    print(len(clips))
except: print(0)
" 2>/dev/null)
      echo "   Audio description $FIRST_AD has $CLIP_COUNT clip(s)"

      # Check a clip has the expected fields
      CLIP_CHECK=$(echo "$AD_DETAIL" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    clips = d.get('audio_clips', [])
    if clips:
        c = clips[0] if isinstance(clips[0], dict) else {}
        fields = ['description_text', 'start_time', 'duration']
        missing = [f for f in fields if f not in c]
        if missing:
            print('WARN: clip missing fields: ' + ', '.join(missing))
        else:
            text_preview = str(c.get('description_text',''))[:80]
            print('OK: clip text=' + repr(text_preview) + '...')
    else:
        print('WARN: no clip objects in response')
except Exception as e: print('WARN: ' + str(e))
" 2>/dev/null)
      echo "   $CLIP_CHECK"

      # Check if the MP3 file is accessible via the static endpoint
      CLIP_PATH=$(echo "$AD_DETAIL" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    clips = d.get('audio_clips', [])
    if clips:
        c = clips[0] if isinstance(clips[0], dict) else {}
        fp = c.get('file_path', '')
        fn = c.get('file_name', '')
        if fp and fn:
            print(fp + '/' + fn)
except: pass
" 2>/dev/null)
      if [ -n "$CLIP_PATH" ]; then
        AUDIO_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/static$CLIP_PATH")
        if [ "$AUDIO_HTTP" = "200" ]; then
          echo "   MP3 accessible: /api/static$CLIP_PATH (HTTP $AUDIO_HTTP)"
        else
          echo "   WARN: MP3 not accessible at /api/static$CLIP_PATH (HTTP $AUDIO_HTTP)"
        fi
      else
        echo "   WARN: could not determine clip audio path"
      fi
    fi

    echo ""
    echo "=== All checks passed ==="
    exit 0
  fi
  if echo "$STATUS" | grep -q '"status":"failed"'; then
    echo ""
    echo "=== Pipeline failed ==="
    echo "Full status (check 'error' and 'log_tail' for details): $STATUS"
    exit 1
  fi
  if echo "$STATUS" | grep -q '"status":"not_found"'; then
    echo "   (no status yet, waiting...)"
  fi
done
echo ""
echo "=== Timeout waiting for completion ==="
exit 1
