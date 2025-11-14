# Postman Test Collection for LANA Endpoint

## Prerequisites Checklist

- [ ] Backend server is running
- [ ] LANA_API_URL environment variable is set (check `.env` file)
- [ ] LANA service is running (if testing full pipeline)

## Test 1: Basic LANA Endpoint Test

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/ai/description/lana`
- **Headers**:
  ```
  Content-Type: application/json
  ```

### Body (raw JSON)
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "user_id": "YOUR_USER_ID_HERE"
}
```

### Expected Response
- **Status**: `201 Created` or `200 OK`
- **Body**: JSON response from LANA service

### Notes
- Replace `YOUR_USER_ID_HERE` with an actual user ID from your database
- Use a YouTube video ID that exists in your system
- For testing with existing descriptions, use a video that already has AI descriptions

---

## Test 2: Alternative LANA Endpoint

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/users/request-ai-descriptions-with-lana`
- **Headers**:
  ```
  Content-Type: application/json
  ```

### Body (raw JSON)
```json
{
  "youtube_id": "dQw4w9WgXcQ",
  "user_id": "YOUR_USER_ID_HERE"
}
```

### Expected Response
- **Status**: `201 Created` or `200 OK`
- **Body**: JSON response from LANA service

---

## Test 3: Test with Existing Video (Recommended First)

According to meeting notes, test with videos that already have generated descriptions first.

### Steps:
1. Find a YouTube video ID that already has AI descriptions in your database
2. Use that video ID in the request
3. Expected: Should return quickly if description already exists

### Example:
```json
{
  "youtube_id": "EXISTING_VIDEO_ID",
  "user_id": "EXISTING_USER_ID"
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "message": "youtubeId is empty"
}
```
**Fix**: Ensure `youtube_id` is provided in request body

### 404 Not Found
```json
{
  "message": "No data found for YouTube ID: {youtube_id}"
}
```
**Fix**: Use a valid YouTube video ID

### 500 Internal Server Error
```json
{
  "message": "LANA_API_URL environment variable is not set"
}
```
**Fix**: Add `LANA_API_URL=http://0.0.0.0:8000` (or your LANA service URL) to `.env` file

### 503 Service Unavailable
```json
{
  "message": "LANA API service is unavailable"
}
```
**Fix**: Ensure LANA service is running and accessible

---

## Testing Checklist

- [ ] Test 1: Basic endpoint test
- [ ] Test 2: Alternative endpoint test  
- [ ] Test 3: Test with existing video (fast response expected)
- [ ] Test 4: Test with new video (triggers pipeline - may have bugs per meeting notes)
- [ ] Check backend logs for any errors
- [ ] Verify response format matches expectations
- [ ] Test error handling with invalid inputs

---

## Getting User ID for Testing

If you need to get a user ID from your database:

1. **MongoDB**:
   ```javascript
   db.users.findOne({}, {_id: 1})
   ```

2. **PostgreSQL**:
   ```sql
   SELECT user_id FROM users LIMIT 1;
   ```

3. **Via API**:
   ```
   GET http://localhost:3000/api/users/get-all-users
   ```

---

## Next Steps After Postman Testing

1. ✅ Verify Postman requests work
2. ✅ Test frontend connection
3. ✅ Test end-to-end flow
4. ✅ Check logs for any issues
5. ✅ Test with real user flow




