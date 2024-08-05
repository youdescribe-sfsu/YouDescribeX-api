import { config } from 'dotenv';
import fs from 'fs';

console.log(`path: .env.${process.env.NODE_ENV || 'development'}.local`);
console.log(process.env);

config({ path: `.env.${process.env.NODE_ENV || 'production'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const { NODE_ENV, HOST, PORT, SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN } = process.env;
export const { YOUTUBE_API_KEY, YOUTUBE_API_URL } = process.env;
export const { PASSPORT_REDIRECT_URL, PASSPORT_CALLBACK_URL, CRYPTO_SECRET, CRYPTO_SEED } = process.env;
export const { MONGO_DB_HOST, MONGO_DB_PORT, MONGO_DB_DATABASE, MONGO_DB_USER, MONGO_DB_PASSWORD } = process.env;
export const { POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRES_DB_HOST, POSTGRES_DB_PORT } = process.env;
export const { CURRENT_DATABASE } = process.env;
export const { AUDIO_DIRECTORY = '/public/audio' } = process.env;
export const { CURRENT_MONGO_DB = 'YDX' } = process.env;
export const { GPU_HOST, GPU_PIPELINE_PORT } = process.env;
export const { CURRENT_YDX_HOST, AI_USER_ID = '650506db3ff1c2140ea10ece' } = process.env;
export const { GMAIL_USER, GMAIL_PASSWORD } = process.env;

export const GPU_URL = GPU_HOST && GPU_PIPELINE_PORT ? `http://${GPU_HOST}:${GPU_PIPELINE_PORT}` : null;

export const GPU_NOTIFY_EMAILS = ['smirani1@mail.sfsu.edu'];

// Generate Google credentials from GOOGLE_CRED_FILE which is encoded in base64
// If GOOGLE_CRED_FILE is not provided, then print that in the console that text to speech will not work
export const GOOGLE_CRED_FILE = process.env.GOOGLE_CRED_FILE;
console.log('GOOGLE_CRED_FILE', GOOGLE_CRED_FILE);
export const GOOGLE_CRED = GOOGLE_CRED_FILE ? JSON.parse(Buffer.from(GOOGLE_CRED_FILE, 'base64').toString()) : null;

// Create a new file Write this GOOGLE_CRED to the root of the project with name tts_api_key.json
// This file will be used to authenticate with google text to speech api
// If GOOGLE_CRED_FILE is not provided, then print that in the console that text to speech will not work
if (GOOGLE_CRED) {
  fs.writeFileSync('tts_api_key.json', JSON.stringify(GOOGLE_CRED));
  console.log('Google credentials have been written to tts_api_key.json for authentication with the Google Text-to-Speech API.');
} else {
  console.log('Google credentials are not provided. Text-to-speech functionality will not work.');
}
