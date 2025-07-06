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

  static async generateSpeech(text: string, speakerType: 'visual' | 'ocr' = 'visual'): Promise<CoquiTTSResponse> {
    try {
      logger.info(`Generating speech with Coqui TTS (American accent): ${text.substring(0, 50)}...`);

      // Get American speaker ID from config
      const speakerId = CONFIG.coqui.speakers[speakerType];

      const response: AxiosResponse = await axios.get(`${this.baseUrl}/api/tts`, {
        params: {
          text: this.preprocessText(text),
          speaker_id: speakerId, // Using correct parameter name for web API
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
   * Health check with American speaker for YouDescribe accessibility platform
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tts`, {
        params: {
          text: 'test',
          speaker_id: 'p256', // Test with American male voice
        },
        timeout: 5000,
        responseType: 'arraybuffer',
      });
      return response.status === 200;
    } catch (error) {
      logger.warn('Coqui TTS server health check failed:', error);
      return false;
    }
  }

  /**
   * Preprocess text for optimal accessibility - clear pronunciation for audio descriptions
   */
  private static preprocessText(text: string): string {
    return (
      text
        // Ensure proper sentence endings for natural pauses
        .replace(/([.!?])\s*$/g, '$1')
        // Handle abbreviations for better pronunciation in accessibility context
        .replace(/\bDr\./g, 'Doctor')
        .replace(/\bMr\./g, 'Mister')
        .replace(/\bMrs\./g, 'Missus')
        .replace(/\bMs\./g, 'Miss')
        // Handle common contractions for clearer speech
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
