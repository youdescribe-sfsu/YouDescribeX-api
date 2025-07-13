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

  static async generateSpeech(text: string, speakerType: 'visual' | 'ocr' = 'visual', lengthScale = 1.0): Promise<CoquiTTSResponse> {
    try {
      logger.info(`Generating speech with Coqui TTS (Neon model, speed: ${lengthScale}): ${text.substring(0, 50)}...`);

      // Neon model uses POST with form data
      const response: AxiosResponse = await axios.post(
        `${this.baseUrl}/api/tts`,
        new URLSearchParams({
          text: this.preprocessText(text),
          length_scale: lengthScale.toString(),
        }),
        {
          timeout: this.timeout,
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

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
   * Health check for Neon model
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/tts`,
        new URLSearchParams({
          text: 'test',
          length_scale: '1.0',
        }),
        {
          timeout: 5000,
          responseType: 'arraybuffer',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );
      return response.status === 200;
    } catch (error) {
      logger.warn('Coqui TTS server health check failed:', error);
      return false;
    }
  }

  /**
   * Preprocess text for optimal accessibility
   */
  private static preprocessText(text: string): string {
    return (
      text
        // Ensure proper sentence endings for natural pauses
        .replace(/([.!?])\s*([A-Z])/g, '$1 $2')
        // Clean up excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove any characters that might cause pronunciation issues
        .replace(/[^\w\s.,!?'-]/g, '')
        .trim()
    );
  }
}

export { CoquiTTSService };
