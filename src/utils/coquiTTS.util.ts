import axios, { AxiosResponse } from 'axios';
import { CONFIG } from '../config';
import { logger } from './logger';

// Types
interface CoquiTTSResponse {
  status: boolean;
  audio?: Buffer;
  error?: string;
}

class CoquiTTSService {
  private static baseUrl = CONFIG.coqui.baseUrl;
  private static timeout = CONFIG.coqui.timeout;

  static async generateSpeech(text: string, speakerId = 'Claribel Dervla', language = 'en'): Promise<CoquiTTSResponse> {
    try {
      logger.info(`Generating speech with Coqui TTS: ${text.substring(0, 50)}...`);

      const response: AxiosResponse = await axios.get(`${this.baseUrl}/api/tts`, {
        params: {
          text: this.preprocessText(text),
          speaker: speakerId, // Coqui server expects speaker_idx parameter
          language: language, // Coqui server expects language_idx parameter
        },
        timeout: this.timeout,
        responseType: 'arraybuffer',
      });

      if (response.status === 200) {
        return {
          status: true,
          audio: Buffer.from(response.data),
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      logger.error('Coqui TTS generation failed:', error);
      return {
        status: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Check if Coqui TTS server is healthy
   */
  static async healthCheck(): Promise<boolean> {
    try {
      // Use root endpoint - /docs returns 404 as verified in testing
      const response = await axios.get(`${this.baseUrl}/`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Coqui TTS server health check failed:', error);
      return false;
    }
  }

  /**
   * Preprocess text for better speech synthesis
   */
  private static preprocessText(text: string): string {
    return (
      text
        // Ensure proper sentence endings
        .replace(/([.!?])\s*$/g, '$1')
        // Handle abbreviations for better pronunciation
        .replace(/\bDr\./g, 'Doctor')
        .replace(/\bMr\./g, 'Mister')
        .replace(/\bMrs\./g, 'Missus')
        .replace(/\bMs\./g, 'Miss')
        // Handle common contractions
        .replace(/won't/g, 'will not')
        .replace(/can't/g, 'cannot')
        .replace(/n't/g, ' not')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}

export { CoquiTTSService, CoquiTTSResponse };
