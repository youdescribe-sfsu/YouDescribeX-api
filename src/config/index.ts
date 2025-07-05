import fs from 'fs';
import path from 'path';
import { ENV } from '../utils/env-initializer';
import { logger } from '../utils/logger';

// Type definitions for configuration
interface DatabaseConfig {
  mongo: {
    host: string;
    port: string;
    database: string;
    user: string;
    password: string;
    currentDb: string;
  };
  postgres: {
    name: string;
    user: string;
    password: string;
    host: string;
    port: string;
  };
  current: string;
}

interface ServerConfig {
  credentials: boolean;
  host: string;
  port: string;
  secretKey: string;
  logFormat: string;
  logDir: string;
  origin: string;
}

interface CoquiConfig {
  baseUrl: string;
  timeout: number;
  models: {
    xtts_v2: string;
  };
  speakers: {
    visual: string;
    ocr: string;
  };
}

interface GoogleConfig {
  youtube: {
    apiKey: string;
    apiUrl: string;
    credentialsPath: string;
    credentialsFile: string;
  };
  vision: {
    credentialsPath: string;
    credentialsFile: string;
  };
  textToSpeech: {
    credentialsPath: string;
    credentialsFile: string;
  };
  speechToText: {
    credentialsPath: string;
    credentialsFile: string;
  };
  applicationCredentials: string;
}

interface AuthConfig {
  passportRedirectUrl: string;
  passportCallbackUrl: string;
  cryptoSecret: string;
  cryptoSeed: string;
  appleRedirectUrl: string;
  appleCallbackUrl: string;
  appleClientId: string;
  appleTeamId: string;
  appleKeyId: string;
}

interface GpuConfig {
  host: string | undefined;
  port: string | undefined;
  url: string | null;
  notifyEmails: string[];
}

interface AppConfig {
  ttsEngine: string;
  nodeEnv: string;
  audioDirectory: string;
  aiUserId: string;
  currentYdxHost: string | undefined;
  email: {
    user: string | undefined;
    password: string | undefined;
  };
  openai: {
    apiKey: string | undefined;
  };
}

// Configuration object
export const CONFIG = {
  server: {
    credentials: process.env.CREDENTIALS === 'true',
    host: process.env.HOST || '',
    port: process.env.PORT || '',
    secretKey: process.env.SECRET_KEY || '',
    logFormat: process.env.LOG_FORMAT || '',
    logDir: process.env.LOG_DIR || '',
    origin: process.env.ORIGIN || '',
  } as ServerConfig,

  coqui: {
    baseUrl: process.env.COQUI_TTS_URL || 'http://localhost:5002',
    timeout: parseInt(process.env.COQUI_TTS_TIMEOUT || '30000'),
    models: {
      xtts_v2: 'tts_models/multilingual/multi-dataset/xtts_v2',
    },
    speakers: {
      visual: 'p225', // Female voice for visual descriptions
      ocr: 'p226', // Male voice for OCR content
    },
  } as CoquiConfig,

  database: {
    mongo: {
      host: process.env.MONGO_DB_HOST || '',
      port: process.env.MONGO_DB_PORT || '',
      database: process.env.MONGO_DB_DATABASE || '',
      user: process.env.MONGO_DB_USER || '',
      password: process.env.MONGO_DB_PASSWORD || '',
      currentDb: process.env.CURRENT_MONGO_DB || 'YDX',
    },
    postgres: {
      name: process.env.POSTGRES_DB_NAME || '',
      user: process.env.POSTGRES_DB_USER || '',
      password: process.env.POSTGRES_DB_PASSWORD || '',
      host: process.env.POSTGRES_DB_HOST || '',
      port: process.env.POSTGRES_DB_PORT || '',
    },
    current: process.env.CURRENT_DATABASE || '',
  } as DatabaseConfig,

  google: {
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY || '',
      apiUrl: process.env.YOUTUBE_API_URL || '',
      credentialsPath: process.env.YOUTUBE_API_CREDENTIALS_PATH || '',
      credentialsFile: process.env.YOUTUBE_API_CREDENTIALS_FILE || '',
    },
    vision: {
      credentialsPath: process.env.VISION_API_CREDENTIALS_PATH || '',
      credentialsFile: process.env.VISION_API_CREDENTIALS_FILE || '',
    },
    textToSpeech: {
      credentialsPath: process.env.TTS_API_CREDENTIALS_PATH || '',
      credentialsFile: process.env.TTS_API_CREDENTIALS_FILE || '',
    },
    speechToText: {
      credentialsPath: process.env.STT_API_CREDENTIALS_PATH || '',
      credentialsFile: process.env.STT_API_CREDENTIALS_FILE || '',
    },
  } as GoogleConfig,

  auth: {
    passportRedirectUrl: process.env.PASSPORT_REDIRECT_URL || '',
    passportCallbackUrl: process.env.PASSPORT_CALLBACK_URL || '',
    appleRedirectUrl: process.env.APPLE_REDIRECT_URL,
    appleCallbackUrl: process.env.APPLE_CALLBACK_URL,
    appleClientId: process.env.APPLE_CLIENT_ID,
    appleTeamId: process.env.APPLE_TEAM_ID,
    appleKeyId: process.env.APPLE_KEY_ID,
    cryptoSecret: process.env.CRYPTO_SECRET || '',
    cryptoSeed: process.env.CRYPTO_SEED || '',
  } as AuthConfig,

  gpu: {
    host: process.env.GPU_HOST,
    port: process.env.GPU_PIPELINE_PORT,
    url: process.env.GPU_HOST && process.env.GPU_PIPELINE_PORT ? `http://${process.env.GPU_HOST}:${process.env.GPU_PIPELINE_PORT}` : null,
    notifyEmails: ['smirani1@mail.sfsu.edu'],
  } as GpuConfig,

  app: {
    nodeEnv: ENV.nodeEnv,
    audioDirectory: process.env.AUDIO_DIRECTORY || '/public/audio',
    aiUserId: process.env.AI_USER_ID || '650506db3ff1c2140ea10ece',
    currentYdxHost: process.env.CURRENT_YDX_HOST,
    email: {
      user: process.env.GMAIL_USER,
      password: process.env.GMAIL_APP_PASSWORD,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    ttsEngine: process.env.TTS_ENGINE || 'google', // 'coqui' or 'google'
  } as AppConfig,
};

// Initialize Google Credentials
const initializeGoogleCredentials = () => {
  const credentialsDir = path.join(__dirname, '../../credentials');

  // Ensure credentials directory exists
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir, { recursive: true });
  }

  // Helper function to write credentials
  const writeCredentials = (base64Content: string | undefined, filePath: string, serviceName: string) => {
    try {
      if (base64Content && filePath) {
        const content = Buffer.from(base64Content, 'base64').toString();
        fs.writeFileSync(filePath, content);
        logger.info(`${serviceName} credentials written successfully`);
      }
    } catch (error) {
      logger.error(`Error writing ${serviceName} credentials:`, error);
    }
  };

  // Write credentials for each service
  const services = [
    {
      content: process.env.YOUTUBE_API_CREDENTIALS_FILE,
      path: CONFIG.google.youtube.credentialsPath,
      name: 'YouTube API',
    },
    {
      content: process.env.VISION_API_CREDENTIALS_FILE,
      path: CONFIG.google.vision.credentialsPath,
      name: 'Vision API',
    },
    {
      content: process.env.TTS_API_CREDENTIALS_FILE,
      path: CONFIG.google.textToSpeech.credentialsPath,
      name: 'Text-to-Speech API',
    },
    {
      content: process.env.STT_API_CREDENTIALS_FILE,
      path: CONFIG.google.speechToText.credentialsPath,
      name: 'Speech-to-Text API',
    },
  ];

  services.forEach(service => {
    writeCredentials(service.content, service.path, service.name);
  });
};

// Initialize credentials
initializeGoogleCredentials();

// Export configuration properties
export const {
  CREDENTIALS,
  HOST,
  PORT,
  SECRET_KEY,
  LOG_FORMAT,
  LOG_DIR,
  ORIGIN,
  YOUTUBE_API_KEY,
  YOUTUBE_API_URL,
  PASSPORT_REDIRECT_URL,
  PASSPORT_CALLBACK_URL,
  CRYPTO_SECRET,
  CRYPTO_SEED,
  MONGO_DB_HOST,
  MONGO_DB_PORT,
  MONGO_DB_DATABASE,
  MONGO_DB_USER,
  MONGO_DB_PASSWORD,
  POSTGRES_DB_NAME,
  POSTGRES_DB_USER,
  POSTGRES_DB_PASSWORD,
  POSTGRES_DB_HOST,
  POSTGRES_DB_PORT,
  CURRENT_DATABASE,
  AUDIO_DIRECTORY,
  CURRENT_MONGO_DB,
  GPU_HOST,
  GPU_PIPELINE_PORT,
  CURRENT_YDX_HOST,
  AI_USER_ID,
  GMAIL_USER,
  GMAIL_APP_PASSWORD,
  OPENAI_API_KEY,
  GPU_URL,
  GPU_NOTIFY_EMAILS,
  APPLE_REDIRECT_URL,
  APPLE_CALLBACK_URL,
  APPLE_CLIENT_ID,
  APPLE_TEAM_ID,
  APPLE_KEY_ID,
} = {
  CREDENTIALS: CONFIG.server.credentials,
  HOST: CONFIG.server.host,
  PORT: CONFIG.server.port,
  SECRET_KEY: CONFIG.server.secretKey,
  LOG_FORMAT: CONFIG.server.logFormat,
  LOG_DIR: CONFIG.server.logDir,
  ORIGIN: CONFIG.server.origin,
  YOUTUBE_API_KEY: CONFIG.google.youtube.apiKey,
  YOUTUBE_API_URL: CONFIG.google.youtube.apiUrl,
  PASSPORT_REDIRECT_URL: CONFIG.auth.passportRedirectUrl,
  PASSPORT_CALLBACK_URL: CONFIG.auth.passportCallbackUrl,
  CRYPTO_SECRET: CONFIG.auth.cryptoSecret,
  CRYPTO_SEED: CONFIG.auth.cryptoSeed,
  MONGO_DB_HOST: CONFIG.database.mongo.host,
  MONGO_DB_PORT: CONFIG.database.mongo.port,
  MONGO_DB_DATABASE: CONFIG.database.mongo.database,
  MONGO_DB_USER: CONFIG.database.mongo.user,
  MONGO_DB_PASSWORD: CONFIG.database.mongo.password,
  POSTGRES_DB_NAME: CONFIG.database.postgres.name,
  POSTGRES_DB_USER: CONFIG.database.postgres.user,
  POSTGRES_DB_PASSWORD: CONFIG.database.postgres.password,
  POSTGRES_DB_HOST: CONFIG.database.postgres.host,
  POSTGRES_DB_PORT: CONFIG.database.postgres.port,
  CURRENT_DATABASE: CONFIG.database.current,
  AUDIO_DIRECTORY: CONFIG.app.audioDirectory,
  CURRENT_MONGO_DB: CONFIG.database.mongo.currentDb,
  GPU_HOST: CONFIG.gpu.host,
  GPU_PIPELINE_PORT: CONFIG.gpu.port,
  CURRENT_YDX_HOST: CONFIG.app.currentYdxHost,
  AI_USER_ID: CONFIG.app.aiUserId,
  GMAIL_USER: CONFIG.app.email.user,
  GMAIL_APP_PASSWORD: CONFIG.app.email.password,
  OPENAI_API_KEY: CONFIG.app.openai.apiKey,
  GPU_URL: CONFIG.gpu.url,
  GPU_NOTIFY_EMAILS: CONFIG.gpu.notifyEmails,
  APPLE_REDIRECT_URL: CONFIG.auth.appleRedirectUrl,
  APPLE_CALLBACK_URL: CONFIG.auth.appleCallbackUrl,
  APPLE_CLIENT_ID: CONFIG.auth.appleClientId,
  APPLE_TEAM_ID: CONFIG.auth.appleTeamId,
  APPLE_KEY_ID: CONFIG.auth.appleKeyId,
};

// Export NODE_ENV separately to avoid redeclaration
export const NODE_ENV = ENV.nodeEnv;

export default CONFIG;
