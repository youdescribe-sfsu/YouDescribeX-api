#!/bin/bash

# Quick test for LANA endpoint
# Replace these with actual values from your database
YOUTUBE_ID="${1:-dQw4w9WgXcQ}"  # Default test video
USER_ID="${2:-test_user_123}"   # Replace with actual user ID

echo "Testing LANA endpoint..."
echo "YouTube ID: $YOUTUBE_ID"
echo "User ID: $USER_ID"
echo ""

curl -X POST http://localhost:3000/api/ai/description/lana \
  -H "Content-Type: application/json" \
  -d "{
    \"youtube_id\": \"$YOUTUBE_ID\",
    \"user_id\": \"$USER_ID\"
  }" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "Done!"




