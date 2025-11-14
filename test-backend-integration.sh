#!/bin/bash

# Test script to verify backend integration is working
# This tests the backend endpoint even if LANA service is down

echo "=========================================="
echo "Testing Backend Integration"
echo "=========================================="
echo ""

BACKEND_URL="http://localhost:8000"
YOUTUBE_ID="${1:-dQw4w9WgXcQ}"
USER_ID="${2:-678d9a587a3479002907e68c}"  # Using a real user ID from your DB

echo "Backend URL: $BACKEND_URL"
echo "YouTube ID: $YOUTUBE_ID"
echo "User ID: $USER_ID"
echo ""

echo "Test 1: Checking backend is running..."
if curl -s -f "$BACKEND_URL/api/users/get-all-users" > /dev/null 2>&1; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running"
    exit 1
fi
echo ""

echo "Test 2: Testing LANA endpoint (will fail if LANA service is down)..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/ai/description/lana" \
  -H "Content-Type: application/json" \
  -d "{
    \"youtube_id\": \"$YOUTUBE_ID\",
    \"user_id\": \"$USER_ID\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" -eq 503 ]; then
    echo "⚠️  Expected: LANA service is unavailable"
    echo "✅ Backend integration is working correctly!"
    echo "   The backend is properly configured and trying to connect to LANA."
    echo "   Next step: Start the LANA service on port 8001"
elif [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ SUCCESS! LANA endpoint is working!"
else
    echo "❌ Unexpected error. Check backend logs."
fi

echo ""
echo "=========================================="




