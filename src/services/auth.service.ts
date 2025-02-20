import { PASSPORT_REDIRECT_URL } from '../config';
import { logger } from '../utils/logger';

class AuthService {
  private validateReturnUrl(url: string): boolean {
    // First check if this is a relative path
    if (url.startsWith('/')) {
      return true; // Allow relative paths within our app
    }

    try {
      const parsedUrl = new URL(url);
      const allowedDomains = [process.env.FRONTEND_DOMAIN, 'youdescribe.org', 'ydx.youdescribe.org'];
      return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch {
      return false;
    }
  }

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
