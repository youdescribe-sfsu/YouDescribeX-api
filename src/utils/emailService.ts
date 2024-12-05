import nodemailer, { Transporter } from 'nodemailer';
import { GMAIL_USER, GMAIL_APP_PASSWORD } from '../config';
import { logger } from './logger';

function formatEmailAsHTML(body: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .paragraph {
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        ${body
          .split('\n')
          .map(line => (line.trim() ? `<div class="paragraph">${line.trim()}</div>` : ''))
          .join('')}
      </body>
    </html>
  `;
}

class EmailService {
  private transporter: Transporter;
  private static instance: EmailService;
  private emailQueue: Array<{
    email: string;
    subject: string;
    content: string;
    resolve: (value: void) => void;
    reject: (reason?: any) => void;
  }> = [];
  private isProcessing = false;
  private readonly MAX_CONCURRENT_EMAILS = 50; // Adjust based on your needs
  private activeEmailCount = 0;

  private constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
      pool: true, // Enable pooling
      maxConnections: 5, // Maximum number of simultaneous connections
      maxMessages: Infinity, // Maximum number of messages to send per connection
      rateDelta: 1000, // Define the time window for rate limiting (1 second)
      rateLimit: 30, // Maximum number of messages per rateDelta (30 per second)
    });

    this.verifyConnection();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('SMTP server connection established successfully');
    } catch (error) {
      logger.error('SMTP connection error:', error);
    }
  }

  private async processEmailQueue() {
    if (this.isProcessing || this.emailQueue.length === 0 || this.activeEmailCount >= this.MAX_CONCURRENT_EMAILS) {
      return;
    }

    this.isProcessing = true;

    while (this.emailQueue.length > 0 && this.activeEmailCount < this.MAX_CONCURRENT_EMAILS) {
      const emailTask = this.emailQueue.shift();
      if (emailTask) {
        this.activeEmailCount++;

        try {
          const { email, subject, content, resolve, reject } = emailTask;

          const mailOptions = {
            from: `"YouDescribe" <${GMAIL_USER}>`,
            to: email,
            subject: subject,
            text: content.replace(/<[^>]*>?/gm, ''), // Strip HTML for text version
            html: content.includes('<') ? content : `<p>${content}</p>`,
          };

          logger.info(`Sending email to: ${email}`);
          const info = await this.transporter.sendMail(mailOptions);

          logger.info(`Email sent successfully to ${email}`);
          console.log(`Email sent :: ${email}`);
          resolve();
        } catch (error) {
          logger.error('Email sending failed:', {
            error: error.message,
            recipient: emailTask.email,
          });
          emailTask.reject(error);
        } finally {
          this.activeEmailCount--;
        }
      }
    }

    this.isProcessing = false;

    // If there are more emails and we're under the limit, continue processing
    if (this.emailQueue.length > 0 && this.activeEmailCount < this.MAX_CONCURRENT_EMAILS) {
      setImmediate(() => this.processEmailQueue());
    }
  }

  async sendEmail(email: string, subject: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const isAlreadyHTML = content.trim().toLowerCase().startsWith('<!doctype html>');
      const htmlContent = isAlreadyHTML ? content : formatEmailAsHTML(content);

      this.emailQueue.push({
        email,
        subject,
        content: htmlContent,
        resolve,
        reject,
      });

      setImmediate(() => this.processEmailQueue());
    });
  }

  public getQueueStatus() {
    return {
      queueLength: this.emailQueue.length,
      activeEmails: this.activeEmailCount,
    };
  }
}

// Export a singleton instance
const emailService = EmailService.getInstance();

// Export the main sendEmail function
export default emailService.sendEmail.bind(emailService);

// Export the full service if needed for monitoring
export const EmailServiceInstance = emailService;
