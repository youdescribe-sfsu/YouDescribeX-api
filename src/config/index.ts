import { config } from 'dotenv';
config({ path: `.env.${process.env.NODE_ENV || 'development'}.local` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const { NODE_ENV, PORT, SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN } = process.env;
export const { MONGO_DB_HOST, MONGO_DB_PORT, MONGO_DB_DATABASE } = process.env;
export const { POSTGRES_DB_NAME, POSTGRES_DB_USER, POSTGRES_DB_PASSWORD, POSTGRES_DB_HOST, POSTGRES_DB_PORT } = process.env;
export const { CURRENT_DATABASE } = process.env;
export const { AUDIO_DIRECTORY = '/public/audio' } = process.env;
export const { CURRENT_MONGO_DB = 'YDX' } = process.env;
