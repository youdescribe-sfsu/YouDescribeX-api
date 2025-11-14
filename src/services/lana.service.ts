import axios from 'axios';
import { logger } from '../utils/logger';
import { HttpException } from '../exceptions/HttpException';

class LanaService {
  /**
   * Request AI description from LANA service
   * @param requestData - Data to send to LANA API
   * @returns Response data from LANA API
   */
  public async requestAiDescriptionWithLana(requestData: any): Promise<any> {
    try {
      const lanaApiUrl = process.env.LANA_API_URL;

      if (!lanaApiUrl) {
        throw new HttpException(500, 'LANA_API_URL environment variable is not set');
      }

      const url = `${lanaApiUrl}/new-ai-description`;

      logger.info(`Sending request to LANA API: ${url}`, { requestData });

      const response = await axios.post(url, requestData);

      logger.info(`LANA API response received`, { status: response.status, data: response.data });

      return response.data;
    } catch (error) {
      logger.error(`Error in requestAiDescriptionWithLana: ${error.message}`, { error });

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        throw new HttpException(error.response.status, error.response.data?.message || 'LANA API request failed');
      } else if (error.request) {
        // The request was made but no response was received
        throw new HttpException(503, 'LANA API service is unavailable');
      } else {
        // Something happened in setting up the request that triggered an Error
        throw new HttpException(500, `Error setting up LANA API request: ${error.message}`);
      }
    }
  }
}

export default LanaService;
