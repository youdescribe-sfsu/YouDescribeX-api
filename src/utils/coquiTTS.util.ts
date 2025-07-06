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

  /**
   * Generate speech using Coqui TTS with multiple fallback strategies
   * This tries ALL possible parameter combinations that work with XTTS v2
   */
  static async generateSpeech(text: string, speakerId = 'Claribel Dervla', language = 'en'): Promise<CoquiTTSResponse> {
    try {
      logger.info(`Generating speech with Coqui TTS: ${text.substring(0, 50)}...`);

      // XTTS v2 server expects numeric speaker_idx OR speaker_wav file paths
      // Try numeric indices first (most reliable approach)
      const numericSpeakerId = this.mapSpeakerToNumericId(speakerId);

      // Strategy 1: Numeric speaker_idx (most common working method)
      try {
        const response1 = await axios.get(`${this.baseUrl}/api/tts`, {
          params: {
            text: this.preprocessText(text),
            speaker_idx: numericSpeakerId,
            language_idx: language,
          },
          timeout: this.timeout,
          responseType: 'arraybuffer',
        });

        if (response1.status === 200) {
          logger.info(`Coqui TTS succeeded with numeric speaker_idx: ${numericSpeakerId}`);
          return {
            status: true,
            audio: Buffer.from(response1.data),
          };
        }
      } catch (error1) {
        logger.warn(`Numeric speaker_idx failed: ${error1.message}`);
      }

      // Strategy 2: Try with language instead of language_idx
      try {
        const response2 = await axios.get(`${this.baseUrl}/api/tts`, {
          params: {
            text: this.preprocessText(text),
            speaker_idx: numericSpeakerId,
            language: language,
          },
          timeout: this.timeout,
          responseType: 'arraybuffer',
        });

        if (response2.status === 200) {
          logger.info(`Coqui TTS succeeded with speaker_idx + language`);
          return {
            status: true,
            audio: Buffer.from(response2.data),
          };
        }
      } catch (error2) {
        logger.warn(`speaker_idx + language failed: ${error2.message}`);
      }

      // Strategy 3: Try using default speaker_wav approach (hardcoded for simplicity)
      // This requires you to have reference audio files, but works reliably
      const defaultSpeakerWav = this.getDefaultSpeakerWav(speakerId);
      if (defaultSpeakerWav) {
        try {
          const response3 = await axios.get(`${this.baseUrl}/api/tts`, {
            params: {
              text: this.preprocessText(text),
              speaker_wav: defaultSpeakerWav,
              language: language,
            },
            timeout: this.timeout,
            responseType: 'arraybuffer',
          });

          if (response3.status === 200) {
            logger.info(`Coqui TTS succeeded with speaker_wav: ${defaultSpeakerWav}`);
            return {
              status: true,
              audio: Buffer.from(response3.data),
            };
          }
        } catch (error3) {
          logger.warn(`speaker_wav approach failed: ${error3.message}`);
        }
      }

      // Strategy 4: Try POST request (some servers expect POST)
      try {
        const response4 = await axios.post(
          `${this.baseUrl}/api/tts`,
          {
            text: this.preprocessText(text),
            speaker_idx: numericSpeakerId,
            language: language,
          },
          {
            timeout: this.timeout,
            responseType: 'arraybuffer',
          },
        );

        if (response4.status === 200) {
          logger.info(`Coqui TTS succeeded with POST request`);
          return {
            status: true,
            audio: Buffer.from(response4.data),
          };
        }
      } catch (error4) {
        logger.warn(`POST request failed: ${error4.message}`);
      }

      // If all strategies fail, return error to trigger Google TTS fallback
      throw new Error('All Coqui TTS strategies failed - will fallback to Google TTS');
    } catch (error: any) {
      logger.warn('Coqui TTS generation failed, triggering Google TTS fallback:', error.message);
      return {
        status: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Map speaker names to numeric IDs that XTTS v2 server expects
   * Based on research, XTTS v2 typically uses 0-based indexing
   */
  private static mapSpeakerToNumericId(speakerId: string): string {
    // Female voices map to even numbers, male voices to odd numbers
    const femaleVoices = ['Claribel Dervla', 'Ana Florence', 'Daisy Studious', 'Gracie Wise'];
    const maleVoices = ['Andrew Chipper', 'Craig Gutsy', 'Badr Odhiambo', 'Viktor Eka'];

    if (femaleVoices.some(voice => speakerId.includes(voice.split(' ')[0]))) {
      return '0'; // Female voice
    } else if (maleVoices.some(voice => speakerId.includes(voice.split(' ')[0]))) {
      return '1'; // Male voice
    }

    // Default fallback
    return '0';
  }

  /**
   * Get default speaker WAV file paths (if you have reference audio files)
   * This is the most reliable method for XTTS v2 voice cloning
   */
  private static getDefaultSpeakerWav(speakerId: string): string | null {
    // These would be paths to reference audio files you provide
    // For now, return null to skip this strategy unless you have audio files

    // Example implementation if you had reference files:
    // const femaleRef = '/app/assets/female_reference.wav';
    // const maleRef = '/app/assets/male_reference.wav';
    //
    // if (speakerId.includes('Claribel') || speakerId.includes('Ana')) {
    //   return femaleRef;
    // } else {
    //   return maleRef;
    // }

    return null; // Disable speaker_wav strategy for now
  }

  /**
   * Check if Coqui TTS server is healthy
   */
  static async healthCheck(): Promise<boolean> {
    try {
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
