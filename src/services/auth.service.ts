import { PASSPORT_REDIRECT_URL } from '../config';
import { logger } from '../utils/logger';

class AuthService {
  private allowedDomains: string[];

  constructor() {
    // Initialize allowed domains from environment and constants
    this.allowedDomains = [process.env.FRONTEND_DOMAIN, 'youdescribe.org', 'ydx.youdescribe.org'].filter(Boolean); // Remove any undefined values
  }

  public validateReturnUrl(url: string, currentHost?: string): boolean {
    try {
      const parsedUrl = new URL(url);

      // If we have a current host, check for exact match first
      if (currentHost && parsedUrl.host === currentHost) {
        return true;
      }

      // Otherwise check against allowed domains
      return this.allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch (error) {
      logger.error('URL validation error:', error);
      return false;
    }
  }

  public getRedirectUrl(returnTo: string | undefined, currentHost?: string): string {
    if (returnTo && this.validateReturnUrl(returnTo, currentHost)) {
      return returnTo;
    }
    return PASSPORT_REDIRECT_URL;
  }
}

export default AuthService;
