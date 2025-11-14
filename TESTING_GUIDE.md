# Testing Guide for LANA AI Description Feature

## Prerequisites

1. **Backend Server Running**
   - Make sure the backend is running on `http://localhost:3000` (or your configured port)
   - Check by visiting: `http://localhost:3000/api/users/get-all-users`

2. **Environment Variables**
   - Ensure `LANA_API_URL` is set in your `.env` file
   - Example: `LANA_API_URL=http://localhost:8000` or `LANA_API_URL=http://0.0.0.0:8000`

3. **LANA Service Running**
   - The LANA service should be running on the port specified in `LANA_API_URL`
   - According to meeting notes, it should be accessible at `http://0.0.0.0:8000/api/new-ai-description`

## Testing Steps

### Step 1: Test with Postman (Recommended First)

1. **Open Postman**

2. **Test Endpoint 1: `/api/ai/description/lana`**
   - Method: `POST`
   - URL: `http://localhost:3000/api/ai/description/lana`
   - Headers:
     ```
     Content-Type: application/json
     ```
   - Body (raw JSON):
     ```json
     {
       "youtube_id": "dQw4w9WgXcQ",
       "user_id": "your_user_id_here"
     }
     ```

3. **Test Endpoint 2: `/api/users/request-ai-descriptions-with-lana`**
   - Method: `POST`
   - URL: `http://localhost:3000/api/users/request-ai-descriptions-with-lana`
   - Headers:
     ```
     Content-Type: application/json
     ```
   - Body (raw JSON):
     ```json
     {
       "youtube_id": "dQw4w9WgXcQ",
       "user_id": "your_user_id_here"
     }
     ```

### Step 2: Test with Videos That Already Have Descriptions

According to the meeting notes, test with videos that already have processed data first:

1. Find a YouTube video ID that already has AI descriptions in your database
2. Use that video ID in your Postman request
3. Expected behavior: Should return quickly if description already exists

### Step 3: Test Frontend Connection

1. **Start Frontend**
   ```bash
   cd /Users/kaustubha/Desktop/YouDescribeX-app
   npm start
   ```

2. **Navigate to a Video Page**
   - Go to: `http://localhost:3000/video/{youtube_id}` (or your frontend URL)

3. **Click "Request AI Description" Button**
   - Should call: `POST /api/ai/description/lana`
   - Check browser Network tab to verify the request

4. **Verify Response**
   - Check browser console for any errors
   - Check backend logs for request processing

### Step 4: Test with New Videos (Pipeline)

⚠️ **Note**: According to meeting notes, the pipeline code still has bugs. Test this only after confirming the basic flow works.

1. Use a YouTube video ID that doesn't have descriptions yet
2. Request AI description
3. Monitor backend logs for pipeline execution
4. Check if description is generated successfully

## Expected Responses

### Success Response
```json
{
  "status": "success",
  "message": "AI description request processed"
}
```

### Error Responses

**400 Bad Request** - Missing or invalid parameters
```json
{
  "message": "youtubeId is empty"
}
```

**404 Not Found** - Video not found
```json
{
  "message": "No data found for YouTube ID: {youtube_id}"
}
```

**500 Internal Server Error** - LANA_API_URL not set
```json
{
  "message": "LANA_API_URL environment variable is not set"
}
```

**503 Service Unavailable** - LANA service unavailable
```json
{
  "message": "LANA API service is unavailable"
}
```

## Troubleshooting

### Backend Not Starting
- Check if port 3000 is already in use
- Verify all environment variables are set
- Check database connection

### LANA_API_URL Error
- Make sure `.env` file has `LANA_API_URL` set
- Restart backend after adding environment variable
- Verify the LANA service is running on that URL

### Frontend Not Connecting
- Check `REACT_APP_YDX_BACKEND_URL` in frontend `.env`
- Verify CORS is configured correctly
- Check browser console for CORS errors

### Request Failing
- Check backend logs: `src/utils/logger.ts` output
- Verify YouTube video ID is valid
- Check if user_id exists in database
- Verify LANA service is accessible from backend

## Test Script

Use the provided test script:
```bash
chmod +x test-lana-endpoint.sh
./test-lana-endpoint.sh [youtube_id] [user_id]
```

Or with custom backend URL:
```bash
BACKEND_URL=http://localhost:3000 ./test-lana-endpoint.sh dQw4w9WgXcQ test_user_id
```

## Checklist

- [ ] Backend server is running
- [ ] LANA_API_URL is set in environment
- [ ] LANA service is running
- [ ] Tested with Postman (both endpoints)
- [ ] Tested with existing video (should return quickly)
- [ ] Frontend connects to backend
- [ ] Frontend button triggers correct endpoint
- [ ] No errors in browser console
- [ ] Backend logs show successful requests
- [ ] Tested with new video (pipeline - if working)




