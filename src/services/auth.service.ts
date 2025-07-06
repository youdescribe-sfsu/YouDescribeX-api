import { PASSPORT_REDIRECT_URL } from '../config';
import { logger } from '../utils/logger';

class AuthService {
  validateReturnUrl = url => {
    const allowedDomains = ['ydx.youdescribe.org', 'ydx-dev.youdescribe.org', 'localhost', process.env.ALLOWED_REDIRECT_DOMAIN];
    try {
      const parsedUrl = new URL(url);
      return allowedDomains.includes(parsedUrl.hostname);
    } catch {
      return false;
    }
  };

  public getRedirectUrl(returnTo: string | undefined): string {
    // If returnTo is a relative path, construct the full URL
    if (returnTo?.startsWith('/')) {
      // Use the configured frontend URL or default
      const baseUrl = process.env.FRONTEND_URL || 'https://ydx.youdescribe.org';
      return `${baseUrl}${returnTo}`;
    }

    if (returnTo && this.validateReturnUrl(returnTo)) {
      return returnTo;
    }
    return PASSPORT_REDIRECT_URL;
  }
}

export default AuthService;
