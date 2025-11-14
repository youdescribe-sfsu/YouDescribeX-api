#!/bin/bash

# Test script for LANA AI Description endpoint
# Usage: ./test-lana-endpoint.sh [youtube_id] [user_id]

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values (replace with your test values)
YOUTUBE_ID="${1:-dQw4w9WgXcQ}"  # Default: Rick Roll video
USER_ID="${2:-test_user_id}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Testing LANA AI Description Endpoint${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Backend URL: $BACKEND_URL"
echo "YouTube ID: $YOUTUBE_ID"
echo "User ID: $USER_ID"
echo ""

# Test 1: Check if backend is running
echo -e "${YELLOW}Test 1: Checking if backend is running...${NC}"
if curl -s -f "$BACKEND_URL/api/users/get-all-users" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running or not accessible at $BACKEND_URL${NC}"
    echo "Please start the backend server first"
    exit 1
fi
echo ""

# Test 2: Test LANA endpoint (via /api/ai/description/lana)
echo -e "${YELLOW}Test 2: Testing LANA endpoint (/api/ai/description/lana)...${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/ai/description/lana" \
  -H "Content-Type: application/json" \
  -d "{
    \"youtube_id\": \"$YOUTUBE_ID\",
    \"user_id\": \"$USER_ID\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status Code: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" -eq 201 ] || [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✓ LANA endpoint responded successfully${NC}"
else
    echo -e "${RED}✗ LANA endpoint returned error status: $HTTP_CODE${NC}"
fi
echo ""

# Test 3: Test alternative endpoint (via /api/users/request-ai-descriptions-with-lana)
echo -e "${YELLOW}Test 3: Testing alternative LANA endpoint (/api/users/request-ai-descriptions-with-lana)...${NC}"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL/api/users/request-ai-descriptions-with-lana" \
  -H "Content-Type: application/json" \
  -d "{
    \"youtube_id\": \"$YOUTUBE_ID\",
    \"user_id\": \"$USER_ID\"
  }")

HTTP_CODE2=$(echo "$RESPONSE2" | tail -n1)
BODY2=$(echo "$RESPONSE2" | sed '$d')

echo "HTTP Status Code: $HTTP_CODE2"
echo "Response Body:"
echo "$BODY2" | jq '.' 2>/dev/null || echo "$BODY2"
echo ""

if [ "$HTTP_CODE2" -eq 201 ] || [ "$HTTP_CODE2" -eq 200 ]; then
    echo -e "${GREEN}✓ Alternative LANA endpoint responded successfully${NC}"
else
    echo -e "${RED}✗ Alternative LANA endpoint returned error status: $HTTP_CODE2${NC}"
fi
echo ""

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Testing Complete${NC}"
echo -e "${YELLOW}========================================${NC}"




