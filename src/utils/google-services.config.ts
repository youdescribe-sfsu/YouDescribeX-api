// Centralized configuration for all Google services
export const GOOGLE_SERVICES = {
  YOUTUBE: {
    API_URL: 'https://www.googleapis.com/youtube/v3',
    ENV_KEYS: {
      development: 'AIzaSyBQFD0fJoEO2l8g0OIrqbtjj2qXXVNO__U', // ydx-dev.youdescribe.org
      production: 'AIzaSyB0M-RYH7PSrQLupvRFhLy4LN98DTMaEBY', // ydx.youdescribe.org
      test: 'AIzaSyAfU2tpVpMKmIyTlRljnKfPUFWXrNXg21Q', // testing
    },
    SCOPES: ['https://www.googleapis.com/auth/youtube.readonly'],
  },
  TEXT_TO_SPEECH: {
    VOICES: {
      VISUAL: 'en-US-Wavenet-D', // Male voice for Visual descriptions
      OCR: 'en-US-Wavenet-C', // Female voice for OCR descriptions
    },
    DEFAULT_SPEAKING_RATE: 1.25,
    DEFAULT_ENCODING: 'MP3',
  },
};

// Helper to get current API key based on environment
export const getCurrentYouTubeApiKey = (env: string = process.env.NODE_ENV || 'development'): string => {
  return GOOGLE_SERVICES.YOUTUBE.ENV_KEYS[env] || GOOGLE_SERVICES.YOUTUBE.ENV_KEYS.development;
};
