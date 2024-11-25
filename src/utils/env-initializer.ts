// src/utils/env-initializer.ts

import { config } from 'dotenv';
import { existsSync, mkdirSync } from 'fs';

export class EnvironmentInitializer {
  static initialize() {
    // Initialize environment configuration
    const CURRENT_NODE_ENV = process.env.NODE_ENV || 'production';
    const ENV_FILE = `.env.${CURRENT_NODE_ENV}.local`;

    // Basic console log for initial loading
    console.log(`[Environment] Loading from: ${ENV_FILE}`);

    try {
      config({ path: ENV_FILE });
      console.log(`[Environment] Successfully loaded ${CURRENT_NODE_ENV} configuration`);

      // Initialize log directory
      const logDir = process.env.LOG_DIR || 'logs';
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
        console.log(`[Environment] Created log directory: ${logDir}`);
      }
    } catch (error) {
      console.error(`[Environment] Error initializing:`, error);
      throw error;
    }

    return {
      nodeEnv: CURRENT_NODE_ENV,
      envFile: ENV_FILE,
    };
  }
}

// Initialize environment before any imports
export const ENV = EnvironmentInitializer.initialize();
