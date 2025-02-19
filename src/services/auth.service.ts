import { PASSPORT_REDIRECT_URL } from '../config';

class AuthService {
  private validateReturnUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      // Add validation logic for allowed domains/paths
      const allowedDomains = [process.env.FRONTEND_DOMAIN, 'youdescribe.org', 'ydx.youdescribe.org'];
      return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  // Add this method to your service
  public getRedirectUrl(returnTo: string | undefined): string {
    if (returnTo && this.validateReturnUrl(returnTo)) {
      return returnTo;
    }
    return PASSPORT_REDIRECT_URL;
  }
}

export default AuthService;
