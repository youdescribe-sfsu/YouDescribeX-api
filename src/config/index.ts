import { config } from 'dotenv';

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
export const { CURRENT_YDX_HOST, AI_USER_ID } = process.env;
export const { GMAIL_USER, GMAIL_PASSWORD } = process.env;
